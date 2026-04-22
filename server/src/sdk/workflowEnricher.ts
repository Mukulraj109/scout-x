/**
 * Workflow Enricher
 * Converts simplified SDK workflow to full format with validation
 */

import { SelectorValidator } from './selectorValidator';
import { createRemoteBrowserForValidation, destroyRemoteBrowser } from '../browser-management/controller';
import logger from '../logger';
import { v4 as uuid } from 'uuid';
import { encrypt } from '../utils/auth';

interface SimplifiedAction {
  action: string | typeof Symbol.asyncDispose;
  args?: any[];
  name?: string;
  actionId?: string;
}

type RegexableString = string | { $regex: string };

interface SimplifiedWorkflowPair {
  where: {
    url?: RegexableString;
    [key: string]: any;
  };
  what: SimplifiedAction[];
}

export class WorkflowEnricher {
  /**
   * Enrich a simplified workflow with full metadata
   */
  static async enrichWorkflow(
    simplifiedWorkflow: SimplifiedWorkflowPair[],
    userId: string
  ): Promise<{ success: boolean; workflow?: any[]; errors?: string[]; url?: string }> {
    const errors: string[] = [];
    const enrichedWorkflow: any[] = [];

    if (simplifiedWorkflow.length === 0) {
      return { success: false, errors: ['Workflow is empty'] };
    }

    let url: string | undefined;
    for (const step of simplifiedWorkflow) {
      const rawUrl = step.where.url;
      if (rawUrl && rawUrl !== 'about:blank') {
        url = typeof rawUrl === 'string' ? rawUrl : rawUrl.$regex;
        break;
      }
    }

    if (!url) {
      return { success: false, errors: ['No valid URL found in workflow'] };
    }

    let browserId: string | null = null;
    const validator = new SelectorValidator();

    try {
      logger.info('Creating RemoteBrowser for validation');
      const { browserId: id, page } = await createRemoteBrowserForValidation(userId);
      browserId = id;

      await validator.initialize(page, url);

      for (const step of simplifiedWorkflow) {
        const enrichedStep: any = {
          where: { ...step.where },
          what: []
        };

        const selectors: string[] = [];

        for (const action of step.what) {
          if (typeof action.action !== 'string') {
            continue;
          }

          if (action.action === 'type') {
            if (!action.args || action.args.length < 2) {
              errors.push('type action missing selector or value');
              continue;
            }

            const selector = action.args[0];
            const value = action.args[1];
            const providedInputType = action.args[2];

            selectors.push(selector);

            const encryptedValue = encrypt(value);

            if (!providedInputType) {
              try {
                const inputType = await validator.detectInputType(selector);
                enrichedStep.what.push({
                  ...action,
                  args: [selector, encryptedValue, inputType]
                });
              } catch (error: any) {
                errors.push(`type action: ${error.message}`);
                continue;
              }
            } else {
              enrichedStep.what.push({
                ...action,
                args: [selector, encryptedValue, providedInputType]
              });
            }

            enrichedStep.what.push({
              action: 'waitForLoadState',
              args: ['networkidle']
            });

            continue;
          }

          if (action.action !== 'scrapeSchema' && action.action !== 'scrapeList') {
            enrichedStep.what.push(action);
            continue;
          }

          if (action.action === 'scrapeSchema') {
            if (!action.args || !action.args[0]) {
              errors.push('scrapeSchema action missing fields argument');
              continue;
            }
            const fields = action.args[0];
            const result = await validator.validateSchemaFields(fields);

            if (!result.valid) {
              errors.push(...(result.errors || []));
              continue;
            }

            const enrichedFields: Record<string, any> = {};
            for (const [fieldName, enrichedData] of Object.entries(result.enriched!)) {
              enrichedFields[fieldName] = {
                tag: enrichedData.tag,
                isShadow: enrichedData.isShadow,
                selector: enrichedData.selector,
                attribute: enrichedData.attribute
              };

              selectors.push(enrichedData.selector);
            }

            const enrichedAction: any = {
              action: 'scrapeSchema',
              actionId: `text-${uuid()}`,
              args: [enrichedFields]
            };
            if (action.name) {
              enrichedAction.name = action.name;
            }
            enrichedStep.what.push(enrichedAction);

            enrichedStep.what.push({
              action: 'waitForLoadState',
              args: ['networkidle']
            });

          } else if (action.action === 'scrapeList') {
            if (!action.args || !action.args[0]) {
              errors.push('scrapeList action missing config argument');
              continue;
            }
            const config = action.args[0];

            let enrichedFields: Record<string, any> = {};
            let listSelector: string;

            try {
              const autoDetectResult = await validator.autoDetectListFields(config.itemSelector);

              if (!autoDetectResult.success || !autoDetectResult.fields || Object.keys(autoDetectResult.fields).length === 0) {
                errors.push(autoDetectResult.error || 'Failed to auto-detect fields from list selector');
                continue;
              }

              enrichedFields = autoDetectResult.fields;
              listSelector = autoDetectResult.listSelector!;
            } catch (error: any) {
              errors.push(`Field auto-detection failed: ${error.message}`);
              continue;
            }

            let paginationType = 'none';
            let paginationSelector = '';

            if (config.pagination && config.pagination.type) {
              paginationType = config.pagination.type;
              paginationSelector = config.pagination.selector || '';
            } else {
              try {
                const paginationResult = await validator.autoDetectPagination(config.itemSelector);

                if (paginationResult.success && paginationResult.type) {
                  paginationType = paginationResult.type;
                  paginationSelector = paginationResult.selector || '';
                }
              } catch (error: any) {
                logger.warn('Pagination auto-detection failed, using default (none):', error.message);
              }
            }

            const enrichedListAction: any = {
              action: 'scrapeList',
              actionId: `list-${uuid()}`,
              args: [{
                fields: enrichedFields,
                listSelector: listSelector,
                pagination: {
                  type: paginationType,
                  selector: paginationSelector
                },
                limit: config.maxItems || 100
              }]
            };
            if (action.name) {
              enrichedListAction.name = action.name;
            }
            enrichedStep.what.push(enrichedListAction);

            enrichedStep.what.push({
              action: 'waitForLoadState',
              args: ['networkidle']
            });
          }
        }

        if (selectors.length > 0) {
          enrichedStep.where.selectors = selectors;
        }

        enrichedWorkflow.push(enrichedStep);
      }

      await validator.close();

      if (browserId) {
        await destroyRemoteBrowser(browserId, userId);
        logger.info('RemoteBrowser cleaned up successfully');
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      return { success: true, workflow: enrichedWorkflow, url };

    } catch (error: any) {
      await validator.close();

      if (browserId) {
        try {
          await destroyRemoteBrowser(browserId, userId);
          logger.info('RemoteBrowser cleaned up after error');
        } catch (cleanupError) {
          logger.warn('Failed to cleanup RemoteBrowser:', cleanupError);
        }
      }

      logger.error('Error enriching workflow:', error);
      return { success: false, errors: [error.message] };
    }
  }
}
