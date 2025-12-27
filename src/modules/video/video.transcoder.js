const ffmpeg = require('fluent-ffmpeg');
const config = require('../../config');
const logger = require('../../shared/services/logger.service');
const { AppError } = require('../../shared/middleware/error.middleware');
const { ERROR_CODE } = require('../../shared/utils/constants');

class VideoTranscoder {
  /**
   * 轉碼視頻為 HLS 格式
   */
  async transcode(inputPath, outputDir, onProgress = null) {
    return new Promise((resolve, reject) => {
      const outputPlaylist = `${outputDir}/index.m3u8`;

      logger.info(`Starting FFmpeg transcoding`, { inputPath, outputDir });

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          `-crf ${config.ffmpeg.crf}`,
          `-preset ${config.ffmpeg.preset}`,
          '-g 48', // Keyframe every 48 frames (~2s at 24fps)
          '-sc_threshold 0', // Disable scene change detection
          `-hls_time ${config.ffmpeg.hlsTime}`,
          '-hls_list_size 0', // Include all segments
          '-f hls',
        ])
        .output(outputPlaylist)
        .on('start', (commandLine) => {
          logger.debug('FFmpeg command', { command: commandLine });
        })
        .on('progress', (progress) => {
          if (progress.percent && onProgress) {
            const percent = Math.round(progress.percent);
            onProgress(percent);
            logger.debug(`FFmpeg progress: ${percent}%`);
          }
        })
        .on('error', (err) => {
          logger.error('FFmpeg error', {
            error: err.message,
            inputPath,
            outputDir,
          });

          reject(
            new AppError(
              422,
              ERROR_CODE.FFMPEG_ERROR,
              `Video transcoding failed: ${err.message}`,
              { inputPath }
            )
          );
        })
        .on('end', () => {
          logger.info('FFmpeg transcoding completed', { outputDir });
          resolve(outputPlaylist);
        })
        .run();
    });
  }

  /**
   * 獲取視頻元數據
   */
  async getMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          logger.error('FFprobe error', { error: err.message, filePath });
          return reject(
            new AppError(
              422,
              ERROR_CODE.FFMPEG_ERROR,
              'Failed to read video metadata',
              { filePath }
            )
          );
        }

        const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
        const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');

        const info = {
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name,
          video: videoStream
            ? {
                codec: videoStream.codec_name,
                width: videoStream.width,
                height: videoStream.height,
                fps: eval(videoStream.r_frame_rate), // 計算 fps
              }
            : null,
          audio: audioStream
            ? {
                codec: audioStream.codec_name,
                sampleRate: audioStream.sample_rate,
                channels: audioStream.channels,
              }
            : null,
        };

        logger.debug('Video metadata extracted', info);
        resolve(info);
      });
    });
  }
}

module.exports = new VideoTranscoder();
