/**
 * 統一響應格式工具
 */
class ResponseUtil {
  /**
   * 成功響應
   */
  success(res, data = null, message = 'Success', statusCode = 200) {
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
    };

    if (data !== null) {
      response.data = data;
    }

    if (message) {
      response.message = message;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * 分頁響應
   */
  paginated(res, items, pagination, message = 'Success') {
    return res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          totalPages: Math.ceil(pagination.total / pagination.pageSize),
        },
      },
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 已接受處理（異步任務）
   */
  accepted(res, data, message = 'Accepted for processing') {
    return this.success(res, data, message, 202);
  }

  /**
   * 已創建
   */
  created(res, data, message = 'Resource created') {
    return this.success(res, data, message, 201);
  }

  /**
   * 無內容
   */
  noContent(res) {
    return res.status(204).send();
  }

  /**
   * 錯誤響應（一般不直接使用，由錯誤中間件處理）
   */
  error(res, statusCode, code, message, details = {}) {
    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

module.exports = new ResponseUtil();
