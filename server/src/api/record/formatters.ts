/**
 * Response shaping for public API robot/run payloads (extracted from api/record.ts).
 */

export const formatRecording = (recordingData: any) => {
  const recordingMeta = recordingData.recording_meta;
  const workflow = recordingData.recording.workflow || [];
  const firstWorkflowStep = recordingMeta.url || workflow[workflow.length - 1]?.where?.url || '';

  const inputParameters = [
    {
      type: 'string',
      name: 'originUrl',
      label: 'Origin URL',
      required: true,
      defaultValue: firstWorkflowStep,
    },
  ];

  return {
    id: recordingMeta.id,
    name: recordingMeta.name,
    createdAt: new Date(recordingMeta.createdAt).getTime(),
    inputParameters,
  };
};

export function formatRunResponse(run: any) {
  const formattedRun = {
    id: run.id,
    status: run.status,
    name: run.name,
    robotId: run.robotMetaId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    runId: run.runId,
    runByUserId: run.runByUserId,
    runByScheduleId: run.runByScheduleId,
    runByAPI: run.runByAPI,
    runBySDK: run.runBySDK,
    data: {
      textData: {},
      listData: {},
      crawlData: {},
      searchData: {},
      markdown: '',
      html: '',
    },
    screenshots: [] as any[],
  };

  const output = run.serializableOutput || {};

  if (output.scrapeSchema && typeof output.scrapeSchema === 'object') {
    formattedRun.data.textData = output.scrapeSchema;
  }

  if (output.scrapeList && typeof output.scrapeList === 'object') {
    formattedRun.data.listData = output.scrapeList;
  }

  if (output.crawl && typeof output.crawl === 'object') {
    formattedRun.data.crawlData = output.crawl;
  }

  if (output.search && typeof output.search === 'object') {
    formattedRun.data.searchData = output.search;
  }

  if (output.markdown && Array.isArray(output.markdown)) {
    formattedRun.data.markdown = output.markdown[0]?.content || '';
  }

  if (output.html && Array.isArray(output.html)) {
    formattedRun.data.html = output.html[0]?.content || '';
  }

  if (run.binaryOutput) {
    Object.keys(run.binaryOutput).forEach((key) => {
      if (run.binaryOutput[key]) {
        formattedRun.screenshots.push(run.binaryOutput[key]);
      }
    });
  }

  return formattedRun;
}
