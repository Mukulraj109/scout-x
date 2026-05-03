import React, { useEffect, useState } from 'react';
import { Box, Button, Divider, FormControlLabel, MenuItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { AccessTime, CalendarMonth, FlashOff, Today } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { getAutomation, updateAutomationConfig } from '../api/automation';
import { useGlobalInfoStore } from '../context/globalInfo';
import { SCHEDULE_OPTIONS } from '../constants/scheduleOptions';
import { DEFAULT_JOB_DATABASE_TARGET_COLUMNS } from '../constants/defaultJobDatabaseColumns';

const DB_TARGET_COL_MAX = 100;
const DB_TARGET_NAME_MAX = 120;
const DB_TARGET_FORBIDDEN = /[,\n\r\t]/;

function parseDatabaseTargetColumnsInput(text: string): { ok: true; list: string[] } | { ok: false; error: string } {
  const raw = text.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const list: string[] = [];
  for (const s of raw) {
    if (s.length > DB_TARGET_NAME_MAX) {
      return { ok: false, error: `Each column name must be at most ${DB_TARGET_NAME_MAX} characters.` };
    }
    if (DB_TARGET_FORBIDDEN.test(s)) {
      return { ok: false, error: 'Names cannot contain commas, tabs, or newlines (use one name per line).' };
    }
    if (seen.has(s)) continue;
    seen.add(s);
    list.push(s);
    if (list.length > DB_TARGET_COL_MAX) {
      return { ok: false, error: `At most ${DB_TARGET_COL_MAX} names.` };
    }
  }
  return { ok: true, list };
}

export const AutomationConfigPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useGlobalInfoStore();
  const [name, setName] = useState('');
  const [startUrl, setStartUrl] = useState('https://');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [databaseTargetColumnsDraft, setDatabaseTargetColumnsDraft] = useState('');
  const [config, setConfig] = useState<Record<string, any>>({
    schedule: {
      enabled: false,
      cron: '0 * * * *',
    },
    destinations: {
      webhook: {
        enabled: false,
        url: '',
        retryAttempts: 3,
        retryDelaySeconds: 5,
        timeoutSeconds: 30,
      },
      googleSheets: {
        enabled: false,
        spreadsheetId: '',
        sheetName: 'Sheet1',
      },
      airtable: {
        enabled: false,
        apiKey: '',
        baseId: '',
        tableName: '',
      },
      database: {
        enabled: false,
        type: 'postgres',
        connectionString: '',
        tableName: 'scraped_rows',
      },
    },
    browserLocation: {
      proxyServer: '',
      proxyUsername: '',
      proxyPassword: '',
    },
    userAgent: '',
    cookies: [],
    localStorage: {},
    dataCleanup: {
      removeEmptyRows: true,
      removeDuplicates: true,
    },
    pagination: {
      mode: 'none',
      autoScroll: false,
      nextButtonSelector: '',
    },
    listExtraction: {
      itemSelector: '',
      uniqueKey: '',
      maxItems: 100,
      autoScroll: false,
      scrollDelayMs: 1200,
      maxScrollIterations: 10,
      fields: {
        title: '',
        location: '',
        link: '',
      },
      pagination: {
        mode: 'none',
        nextButtonSelector: '',
        maxPages: 5,
        startPage: 0,
        pageParam: 'page',
        pageDelayMs: 1200,
      },
    },
  });

  const normalizeStartUrl = (value: string) => {
    const trimmedValue = String(value || '').trim();

    if (!trimmedValue) {
      return '';
    }

    const collapsedProtocolValue = trimmedValue.replace(/^(https?:\/\/)+/i, (match) =>
      match.toLowerCase().startsWith('https://') ? 'https://' : 'http://'
    );

    const normalizedCandidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(collapsedProtocolValue)
      ? collapsedProtocolValue
      : `https://${collapsedProtocolValue}`;

    try {
      return new URL(normalizedCandidate).toString();
    } catch {
      return trimmedValue;
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const response = await getAutomation(id);
        const automation = response.automation;
        setName(automation.name || '');
        setStartUrl(automation.targetUrl || 'https://');
        setWebhookUrl(automation.webhookUrl || '');
        setConfig((current) => ({
          ...current,
          ...(automation.config || {}),
          schedule: automation.schedule || automation.config?.schedule || current.schedule,
        }));
        const fromApi = automation.config?.databaseTargetColumns;
        if (Array.isArray(fromApi)) {
          setDatabaseTargetColumnsDraft(
            fromApi.map((c: unknown) => String(c || '').trim()).filter(Boolean).join('\n')
          );
        } else {
          setDatabaseTargetColumnsDraft(DEFAULT_JOB_DATABASE_TARGET_COLUMNS.join('\n'));
        }
      } catch (error: any) {
        notify('error', error?.response?.data?.error || 'Failed to load automation config');
      }
    };

    load();
  }, [id]);

  const updateNested = (path: string[], value: any) => {
    setConfig((current) => {
      const next = { ...current };
      let pointer: any = next;
      path.slice(0, -1).forEach((key) => {
        pointer[key] = { ...(pointer[key] || {}) };
        pointer = pointer[key];
      });
      pointer[path[path.length - 1]] = value;
      return next;
    });
  };

  const handleSave = async () => {
    const parsedTargets = parseDatabaseTargetColumnsInput(databaseTargetColumnsDraft);
    if (!parsedTargets.ok) {
      notify('error', parsedTargets.error);
      return;
    }
    try {
      await updateAutomationConfig(id, {
        name,
        startUrl: normalizeStartUrl(startUrl),
        webhookUrl,
        config: { ...config, databaseTargetColumns: parsedTargets.list },
      });
      notify('success', 'Automation configuration saved');
      navigate('/dashboard');
    } catch (error: any) {
      notify('error', error?.response?.data?.error || 'Failed to save automation config');
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Scraper Configuration</Typography>
          <Typography variant="body1" color="text.secondary">
            Runtime settings persisted into Postgres and passed through the automation run pipeline.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate('/dashboard')}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          <TextField label="Automation Name" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField
            label="Start URL"
            value={startUrl}
            onChange={(event) => setStartUrl(event.target.value)}
            onBlur={() => setStartUrl((current) => normalizeStartUrl(current) || current)}
          />
          <TextField label="Webhook URL" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} />

          <Divider />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Database column names</Typography>
          <Typography variant="body2" color="text.secondary">
            Paste the attribute names your warehouse uses (one per line or comma-separated). Job-focused defaults are
            pre-filled until you save — edit them to match your schema. On Extracted Data, &quot;Edit columns&quot;
            uses this list as the mapping dropdown.
          </Typography>
          <TextField
            label="Target columns for mapping"
            value={databaseTargetColumnsDraft}
            onChange={(event) => setDatabaseTargetColumnsDraft(event.target.value)}
            multiline
            minRows={4}
            placeholder={'posted_date\njob_url\ncompany_name'}
            helperText="Example: match your Postgres / BigQuery / API field names exactly. Leave empty to type renames manually in Edit columns."
          />

          <Divider />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Scheduling</Typography>
          <FormControlLabel
            control={<Switch checked={!!config.schedule?.enabled} onChange={(event) => updateNested(['schedule', 'enabled'], event.target.checked)} />}
            label={<Typography variant="body2" fontWeight={500}>Enable automatic runs</Typography>}
          />

          {/* Visual schedule picker */}
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: 13 }}>
              Select a run interval:
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' },
                gap: 1.25,
              }}
            >
              {SCHEDULE_OPTIONS.map((option) => {
                const isSelected = option.cron === (config.schedule?.cron || null);
                const isOff = option.cron === null;

                return (
                  <Box
                    key={option.label}
                    onClick={() => {
                      updateNested(['schedule', 'cron'], option.cron || '');
                      if (option.cron === null) {
                        updateNested(['schedule', 'enabled'], false);
                      } else if (!config.schedule?.enabled) {
                        updateNested(['schedule', 'enabled'], true);
                      }
                    }}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: '2px solid',
                      borderColor: isSelected
                        ? isOff ? '#f59e0b' : 'primary.main'
                        : 'divider',
                      background: isSelected
                        ? isOff
                          ? 'rgba(245,158,11,0.08)'
                          : 'rgba(99,102,241,0.07)'
                        : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.16s ease',
                      boxShadow: isSelected
                        ? `0 0 0 3px ${isOff ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)'}`
                        : 'none',
                      '&:hover': {
                        borderColor: isOff ? '#f59e0b' : 'primary.main',
                        background: isOff
                          ? 'rgba(245,158,11,0.05)'
                          : 'rgba(99,102,241,0.05)',
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
                      <Box
                        sx={{
                          fontSize: 15,
                          color: isSelected ? (isOff ? '#f59e0b' : 'primary.main') : 'text.secondary',
                          display: 'flex',
                        }}
                      >
                        {option.cron === null ? <FlashOff sx={{ fontSize: 16 }} /> :
                         option.label.includes('week') || option.label.includes('month') ? <CalendarMonth sx={{ fontSize: 16 }} /> :
                         option.label.includes('day') ? <Today sx={{ fontSize: 16 }} /> :
                         <AccessTime sx={{ fontSize: 16 }} />}
                      </Box>
                      <Typography
                        variant="body2"
                        fontWeight={isSelected ? 700 : 600}
                        sx={{
                          color: isSelected ? (isOff ? '#f59e0b' : 'primary.main') : 'text.primary',
                          fontSize: 12,
                          lineHeight: 1.2,
                        }}
                      >
                        {option.label}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', fontSize: 10.5, lineHeight: 1.3, display: 'block' }}
                    >
                      {option.description}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Show raw cron if custom value set outside the options */}
            {config.schedule?.cron &&
              !SCHEDULE_OPTIONS.find((o) => o.cron === config.schedule?.cron) && (
                <Box sx={{ mt: 1.5 }}>
                  <TextField
                    label="Custom Cron Expression"
                    size="small"
                    fullWidth
                    value={config.schedule?.cron || ''}
                    onChange={(event) => updateNested(['schedule', 'cron'], event.target.value)}
                    helperText="Custom expression entered. Select a card above to use a preset."
                  />
                </Box>
              )}
          </Box>

          <Divider />
          <Typography variant="h6">Destinations</Typography>
          <FormControlLabel
            control={<Switch checked={!!config.destinations?.webhook?.enabled} onChange={(event) => updateNested(['destinations', 'webhook', 'enabled'], event.target.checked)} />}
            label="Enhanced Webhook Destination"
          />
          <TextField
            label="Destination Webhook URL"
            value={config.destinations?.webhook?.url || webhookUrl || ''}
            onChange={(event) => {
              updateNested(['destinations', 'webhook', 'url'], event.target.value);
              setWebhookUrl(event.target.value);
            }}
          />
          <TextField
            label="Webhook Retry Attempts"
            type="number"
            value={config.destinations?.webhook?.retryAttempts || 3}
            onChange={(event) => updateNested(['destinations', 'webhook', 'retryAttempts'], parseInt(event.target.value || '3', 10))}
          />
          <TextField
            label="Webhook Retry Delay (seconds)"
            type="number"
            value={config.destinations?.webhook?.retryDelaySeconds || 5}
            onChange={(event) => updateNested(['destinations', 'webhook', 'retryDelaySeconds'], parseInt(event.target.value || '5', 10))}
          />
          <TextField
            label="Webhook Timeout (seconds)"
            type="number"
            value={config.destinations?.webhook?.timeoutSeconds || 30}
            onChange={(event) => updateNested(['destinations', 'webhook', 'timeoutSeconds'], parseInt(event.target.value || '30', 10))}
          />

          <FormControlLabel
            control={<Switch checked={!!config.destinations?.googleSheets?.enabled} onChange={(event) => updateNested(['destinations', 'googleSheets', 'enabled'], event.target.checked)} />}
            label="Google Sheets"
          />
          <TextField
            label="Spreadsheet ID"
            value={config.destinations?.googleSheets?.spreadsheetId || ''}
            onChange={(event) => updateNested(['destinations', 'googleSheets', 'spreadsheetId'], event.target.value)}
            helperText="Requires the existing Google account connection in Scout-X Scrapper."
          />
          <TextField
            label="Sheet Name"
            value={config.destinations?.googleSheets?.sheetName || 'Sheet1'}
            onChange={(event) => updateNested(['destinations', 'googleSheets', 'sheetName'], event.target.value)}
          />

          <FormControlLabel
            control={<Switch checked={!!config.destinations?.airtable?.enabled} onChange={(event) => updateNested(['destinations', 'airtable', 'enabled'], event.target.checked)} />}
            label="Airtable"
          />
          <TextField
            label="Airtable API Key"
            type="password"
            value={config.destinations?.airtable?.apiKey || ''}
            onChange={(event) => updateNested(['destinations', 'airtable', 'apiKey'], event.target.value)}
          />
          <TextField
            label="Airtable Base ID"
            value={config.destinations?.airtable?.baseId || ''}
            onChange={(event) => updateNested(['destinations', 'airtable', 'baseId'], event.target.value)}
          />
          <TextField
            label="Airtable Table Name"
            value={config.destinations?.airtable?.tableName || ''}
            onChange={(event) => updateNested(['destinations', 'airtable', 'tableName'], event.target.value)}
          />

          <FormControlLabel
            control={<Switch checked={!!config.destinations?.database?.enabled} onChange={(event) => updateNested(['destinations', 'database', 'enabled'], event.target.checked)} />}
            label="External Database"
          />
          <TextField
            select
            label="Database Type"
            value={config.destinations?.database?.type || 'postgres'}
            onChange={(event) => updateNested(['destinations', 'database', 'type'], event.target.value)}
          >
            <MenuItem value="postgres">Postgres</MenuItem>
            <MenuItem value="mysql">MySQL</MenuItem>
          </TextField>
          <TextField
            label="Connection String"
            value={config.destinations?.database?.connectionString || ''}
            onChange={(event) => updateNested(['destinations', 'database', 'connectionString'], event.target.value)}
          />
          <TextField
            label="Destination Table"
            value={config.destinations?.database?.tableName || 'scraped_rows'}
            onChange={(event) => updateNested(['destinations', 'database', 'tableName'], event.target.value)}
          />

          <Divider />
          <Typography variant="h6">Browser Location</Typography>
          <TextField label="Proxy Server" value={config.browserLocation?.proxyServer || ''} onChange={(event) => updateNested(['browserLocation', 'proxyServer'], event.target.value)} />
          <TextField label="Proxy Username" value={config.browserLocation?.proxyUsername || ''} onChange={(event) => updateNested(['browserLocation', 'proxyUsername'], event.target.value)} />
          <TextField label="Proxy Password" type="password" value={config.browserLocation?.proxyPassword || ''} onChange={(event) => updateNested(['browserLocation', 'proxyPassword'], event.target.value)} />

          <Divider />
          <Typography variant="h6">Identity</Typography>
          <TextField label="User Agent" value={config.userAgent || ''} onChange={(event) => updateNested(['userAgent'], event.target.value)} />
          <TextField
            label="Cookies (JSON array)"
            multiline
            minRows={3}
            value={JSON.stringify(config.cookies || [], null, 2)}
            onChange={(event) => {
              try {
                updateNested(['cookies'], JSON.parse(event.target.value || '[]'));
              } catch {
                // keep editing state permissive
              }
            }}
          />
          <TextField
            label="Local Storage (JSON object)"
            multiline
            minRows={3}
            value={JSON.stringify(config.localStorage || {}, null, 2)}
            onChange={(event) => {
              try {
                updateNested(['localStorage'], JSON.parse(event.target.value || '{}'));
              } catch {
                // keep editing state permissive
              }
            }}
          />

          <Divider />
          <Typography variant="h6">Data Cleanup</Typography>
          <FormControlLabel
            control={<Switch checked={!!config.dataCleanup?.removeEmptyRows} onChange={(event) => updateNested(['dataCleanup', 'removeEmptyRows'], event.target.checked)} />}
            label="Remove empty rows"
          />
          <FormControlLabel
            control={<Switch checked={!!config.dataCleanup?.removeDuplicates} onChange={(event) => updateNested(['dataCleanup', 'removeDuplicates'], event.target.checked)} />}
            label="Remove duplicates"
          />

          <Divider />
          <Typography variant="h6">Pagination</Typography>
          <TextField
            select
            label="Pagination Mode"
            value={config.pagination?.mode || 'none'}
            onChange={(event) => updateNested(['pagination', 'mode'], event.target.value)}
          >
            <MenuItem value="none">None</MenuItem>
            <MenuItem value="auto-scroll">Auto Scroll</MenuItem>
            <MenuItem value="selector">Selector Based</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={!!config.pagination?.autoScroll} onChange={(event) => updateNested(['pagination', 'autoScroll'], event.target.checked)} />}
            label="Enable auto scroll"
          />
          <TextField label="Next Button Selector" value={config.pagination?.nextButtonSelector || ''} onChange={(event) => updateNested(['pagination', 'nextButtonSelector'], event.target.value)} />

          <Divider />
          <Typography variant="h6">List Extraction Engine</Typography>
          <TextField
            label="Item Selector"
            value={config.listExtraction?.itemSelector || ''}
            onChange={(event) => updateNested(['listExtraction', 'itemSelector'], event.target.value)}
            helperText="Example: .container > .item"
          />
          <TextField
            label="Field Mapping (JSON object)"
            multiline
            minRows={6}
            value={JSON.stringify(config.listExtraction?.fields || {}, null, 2)}
            onChange={(event) => {
              try {
                updateNested(['listExtraction', 'fields'], JSON.parse(event.target.value || '{}'));
              } catch {
                // keep editing state permissive
              }
            }}
            helperText='Example: {"title":".job-title","location":".location","link":"a@href"}'
          />
          <TextField
            label="Unique Key"
            value={config.listExtraction?.uniqueKey || ''}
            onChange={(event) => updateNested(['listExtraction', 'uniqueKey'], event.target.value)}
            helperText="Example: link"
          />
          <TextField
            label="Max Items"
            type="number"
            value={config.listExtraction?.maxItems || 100}
            onChange={(event) => updateNested(['listExtraction', 'maxItems'], parseInt(event.target.value || '100', 10))}
          />
          <FormControlLabel
            control={<Switch checked={!!config.listExtraction?.autoScroll} onChange={(event) => updateNested(['listExtraction', 'autoScroll'], event.target.checked)} />}
            label="Auto scroll list pages"
          />
          <TextField
            label="Scroll Delay (ms)"
            type="number"
            value={config.listExtraction?.scrollDelayMs || 1200}
            onChange={(event) => updateNested(['listExtraction', 'scrollDelayMs'], parseInt(event.target.value || '1200', 10))}
          />
          <TextField
            label="Max Scroll Iterations"
            type="number"
            value={config.listExtraction?.maxScrollIterations || 10}
            onChange={(event) => updateNested(['listExtraction', 'maxScrollIterations'], parseInt(event.target.value || '10', 10))}
          />
          <TextField
            select
            label="List Pagination"
            value={config.listExtraction?.pagination?.mode || 'none'}
            onChange={(event) => updateNested(['listExtraction', 'pagination', 'mode'], event.target.value)}
          >
            <MenuItem value="none">None</MenuItem>
            <MenuItem value="next-button">Next Button Click</MenuItem>
            <MenuItem value="infinite-scroll">Infinite Scroll</MenuItem>
            <MenuItem value="page-number-loop">Page Number Loop</MenuItem>
          </TextField>
          <TextField
            label="List Next Button Selector"
            value={config.listExtraction?.pagination?.nextButtonSelector || ''}
            onChange={(event) => updateNested(['listExtraction', 'pagination', 'nextButtonSelector'], event.target.value)}
          />
          <TextField
            label="Max Pages"
            type="number"
            value={config.listExtraction?.pagination?.maxPages || 5}
            onChange={(event) => updateNested(['listExtraction', 'pagination', 'maxPages'], parseInt(event.target.value || '5', 10))}
          />
          <TextField
            label="Start Page"
            type="number"
            value={config.listExtraction?.pagination?.startPage ?? 0}
            onChange={(event) => updateNested(['listExtraction', 'pagination', 'startPage'], parseInt(event.target.value || '0', 10))}
          />
          <TextField
            label="Page Query Param"
            value={config.listExtraction?.pagination?.pageParam || 'page'}
            onChange={(event) => updateNested(['listExtraction', 'pagination', 'pageParam'], event.target.value)}
          />
        </Stack>
      </Paper>
    </Box>
  );
};
