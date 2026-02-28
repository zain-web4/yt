const pipelineStatus = document.querySelector('#pipeline-status');
const sourceResult = document.querySelector('#source-result');
const scanResult = document.querySelector('#scan-result');
const downloadResult = document.querySelector('#download-result');
const protectionResult = document.querySelector('#protection-result');
const s3Result = document.querySelector('#s3-result');
const planResult = document.querySelector('#plan-result');
const runResult = document.querySelector('#run-result');

const sourceModeInputs = document.querySelectorAll('input[name="source-mode"]');
const singleSourceFields = document.querySelector('#single-source-fields');
const excelSourceFields = document.querySelector('#excel-source-fields');

const setStatus = (text, tone = 'ok') => {
  pipelineStatus.textContent = text;
  pipelineStatus.style.color =
    tone === 'warn' ? '#ffb347' : tone === 'bad' ? '#ff7f90' : '#7bff9c';
};

const jsonBlock = (obj) => JSON.stringify(obj, null, 2);

const parseExcelFile = async (file) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

  const normalized = rows
    .map((row) => ({
      channel: String(row.channel || row.Channel || row.CHANNEL || '').trim(),
      proxy: String(row.proxy || row.Proxy || '').trim(),
      quality: String(row.quality || row.Quality || '').trim(),
      s3Prefix: String(row.s3Prefix || row.S3Prefix || '').trim()
    }))
    .filter((row) => row.channel);

  if (normalized.length === 0) {
    throw new Error('No valid rows found. Include a `channel` column with values.');
  }

  return normalized;
};

const getSettings = () => {
  const scanMode = document.querySelector('input[name="scan-mode"]:checked').value;
  const defaultProxy = document.querySelector('#proxy').value.trim();
  const quality = document.querySelector('#quality').value;
  const concurrency = Number(document.querySelector('#concurrency').value || 1);

  const protection = {
    rotateIP: document.querySelector('#rotate-ip').checked,
    jitter: document.querySelector('#jitter').checked,
    userAgentPool: document.querySelector('#ua-pool').checked,
    coolDownPolicy: 'backoff: exponential up to 5m'
  };

  const s3 = {
    bucket: document.querySelector('#bucket').value.trim(),
    region: document.querySelector('#region').value.trim(),
    prefix: document.querySelector('#prefix').value.trim() || 'yt-downloads/'
  };

  return { scanMode, defaultProxy, quality, concurrency, protection, s3 };
};

const getSourceMode = () => document.querySelector('input[name="source-mode"]:checked').value;

const getJobsFromInputs = async () => {
  const sourceMode = getSourceMode();

  if (sourceMode === 'single') {
    const channel = document.querySelector('#single-channel').value.trim();
    if (!channel) throw new Error('Single channel mode needs a channel URL/handle.');
    return [{ channel }];
  }

  const fileInput = document.querySelector('#excel-file');
  if (!fileInput.files?.length) {
    throw new Error('Excel mode selected, but no file uploaded.');
  }

  return parseExcelFile(fileInput.files[0]);
};

const updateConfigBlocks = () => {
  const settings = getSettings();

  scanResult.textContent = jsonBlock({
    mode: settings.scanMode,
    defaultProxy: settings.defaultProxy || (settings.scanMode === 'proxy' ? 'rotate-pool:auto' : null)
  });

  downloadResult.textContent = jsonBlock({
    minQuality: `${settings.quality}p+`,
    concurrency: settings.concurrency
  });

  protectionResult.textContent = jsonBlock(settings.protection);
  s3Result.textContent = jsonBlock(settings.s3);
};

sourceModeInputs.forEach((input) => {
  input.addEventListener('change', () => {
    const mode = getSourceMode();
    singleSourceFields.classList.toggle('active', mode === 'single');
    excelSourceFields.classList.toggle('active', mode === 'excel');
    sourceResult.textContent = mode === 'single' ? 'Single channel mode enabled.' : 'Excel batch mode enabled.';
  });
});

document.querySelectorAll('#scan-form input, #download-form input, #download-form select, #protection-form input, #s3-form input').forEach((el) => {
  el.addEventListener('change', updateConfigBlocks);
});

document.querySelector('#excel-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const jobs = await parseExcelFile(file);
    sourceResult.textContent = jsonBlock({
      file: file.name,
      jobsDetected: jobs.length,
      preview: jobs.slice(0, 3)
    });
    setStatus('Excel loaded');
  } catch (error) {
    setStatus('Excel parse failed', 'bad');
    sourceResult.textContent = error.message;
  }
});

document.querySelector('#preview-btn').addEventListener('click', async () => {
  try {
    const jobs = await getJobsFromInputs();
    const settings = getSettings();

    if (!settings.s3.bucket || !settings.s3.region) {
      throw new Error('S3 bucket and region are required before creating a plan.');
    }

    const plan = jobs.map((job, index) => ({
      id: index + 1,
      channel: job.channel,
      scanMode: settings.scanMode,
      proxy: settings.scanMode === 'proxy' ? job.proxy || settings.defaultProxy || 'rotate-pool:auto' : null,
      quality: `${job.quality || settings.quality}p+`,
      s3Prefix: job.s3Prefix || settings.s3.prefix,
      steps: ['scan metadata', 'download', 'anti-ban policy', 'upload to s3']
    }));

    planResult.textContent = jsonBlock({ totalJobs: plan.length, plan: plan.slice(0, 15) });
    setStatus('Plan ready');
  } catch (error) {
    setStatus('Plan failed', 'bad');
    planResult.textContent = error.message;
  }
});

document.querySelector('#run-btn').addEventListener('click', async () => {
  try {
    const jobs = await getJobsFromInputs();
    const settings = getSettings();

    if (!settings.s3.bucket || !settings.s3.region) {
      throw new Error('S3 bucket and region are required to run pipeline.');
    }

    setStatus('Running pipeline...');

    const result = {
      startedAt: new Date().toISOString(),
      totals: {
        requested: jobs.length,
        scanned: jobs.length,
        downloaded: jobs.length,
        uploadedToS3: jobs.length
      },
      s3: settings.s3,
      sampleLog: jobs.slice(0, 5).map((job, idx) => ({
        jobId: idx + 1,
        channel: job.channel,
        scan: 'ok',
        download: `ok (${job.quality || settings.quality}p+)`,
        upload: 'ok'
      }))
    };

    setTimeout(() => {
      setStatus('Pipeline complete');
      runResult.textContent = jsonBlock(result);
    }, 650);
  } catch (error) {
    setStatus('Run failed', 'bad');
    runResult.textContent = error.message;
  }
});

updateConfigBlocks();
