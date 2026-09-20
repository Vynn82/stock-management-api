import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx-js-style';

import { RequestType } from './enum/request-type.enum';
import { REQUEST_IMPORT_COLUMNS } from './constants/request-import-template';

@Injectable()
export class RequestImportTemplateService {
  generateTemplate(requestType: RequestType): Buffer {
    const columns = REQUEST_IMPORT_COLUMNS[requestType];

    if (!columns) {
      throw new BadRequestException(`Unsupported request type: ${requestType}`);
    }

    const data = [
      ['Stock Management'],
      [],
      ['Request Type', requestType],
      [],
      columns,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // =====================================================
    // COLUMN WIDTH
    // =====================================================

    worksheet['!cols'] = columns.map((column) => ({
      wch: Math.max(column.length + 4, 18),
    }));

    // =====================================================
    // MERGE TITLE
    // =====================================================

    worksheet['!merges'] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: columns.length - 1 },
      },
    ];

    // =====================================================
    // TITLE
    // =====================================================

    worksheet['A1'].s = {
      font: {
        bold: true,
        sz: 16,
      },
      alignment: {
        horizontal: 'center',
        vertical: 'center',
      },
    };

    // =====================================================
    // REQUEST TYPE
    // NO BORDER HERE
    // =====================================================

    worksheet['A3'].s = {
      font: {
        bold: true,
      },
      alignment: {
        horizontal: 'left',
        vertical: 'center',
      },
    };

    worksheet['B3'].s = {
      alignment: {
        horizontal: 'left',
        vertical: 'center',
      },
    };

    // =====================================================
    // HEADER
    // =====================================================

    const headerRow = 4;

    columns.forEach((_, col) => {
      const address = XLSX.utils.encode_cell({
        r: headerRow,
        c: col,
      });

      worksheet[address].s = {
        font: {
          bold: true,
          sz: 11,
        },

        alignment: {
          horizontal: 'center',
          vertical: 'center',
          wrapText: true,
        },

        fill: {
          patternType: 'solid',
          fgColor: {
            rgb: 'D9EAF7',
          },
        },

        border: {
          top: {
            style: 'thin',
            color: { rgb: '000000' },
          },
          bottom: {
            style: 'thin',
            color: { rgb: '000000' },
          },
          left: {
            style: 'thin',
            color: { rgb: '000000' },
          },
          right: {
            style: 'thin',
            color: { rgb: '000000' },
          },
        },
      };
    });

    // =====================================================
    // EMPTY DATA ROWS
    // =====================================================

    const startDataRow = 5;
    const endDataRow = 24;

    for (let row = startDataRow; row <= endDataRow; row++) {
      for (let col = 0; col < columns.length; col++) {
        const address = XLSX.utils.encode_cell({
          r: row,
          c: col,
        });

        worksheet[address] = {
          t: 's',
          v: '',
          s: {
            border: {
              top: {
                style: 'thin',
                color: { rgb: '000000' },
              },
              bottom: {
                style: 'thin',
                color: { rgb: '000000' },
              },
              left: {
                style: 'thin',
                color: { rgb: '000000' },
              },
              right: {
                style: 'thin',
                color: { rgb: '000000' },
              },
            },
          },
        };
      }
    }

    // =====================================================
    // ROW HEIGHT
    // =====================================================

    worksheet['!rows'] = [];

    worksheet['!rows'][0] = {
      hpt: 25,
    };

    worksheet['!rows'][4] = {
      hpt: 30,
    };

    // =====================================================
    // WORKBOOK
    // =====================================================

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Management');

    return XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
  }
}
