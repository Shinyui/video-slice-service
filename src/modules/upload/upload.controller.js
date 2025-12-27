const uploadService = require('./upload.service');
const { AppError } = require('../../shared/middleware/error.middleware');
const { asyncHandler } = require('../../shared/middleware/error.middleware');
const responseUtil = require('../../shared/utils/response.util');
const { ERROR_CODE } = require('../../shared/utils/constants');

class UploadController {
  /**
   * 處理文件上傳
   */
  uploadFile = asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, ERROR_CODE.MISSING_FILE, 'No file provided');
    }

    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    const result = await uploadService.handleUpload(req.file, metadata);

    return responseUtil.accepted(res, result, 'File accepted for processing');
  });

  /**
   * 獲取任務狀態
   */
  getStatus = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const status = await uploadService.getJobStatus(jobId);

    if (!status) {
      throw new AppError(404, ERROR_CODE.JOB_NOT_FOUND, `Job ${jobId} not found`);
    }

    return responseUtil.success(res, status);
  });

  /**
   * 獲取任務列表
   */
  listJobs = asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      pageSize: parseInt(req.query.pageSize) || 20,
      status: req.query.status,
      sortBy: req.query.sortBy || 'createdAt',
      order: req.query.order || 'desc',
    };

    const result = await uploadService.listJobs(options);

    return responseUtil.paginated(
      res,
      result.items,
      result.pagination,
      'Jobs retrieved successfully'
    );
  });
}

module.exports = new UploadController();
