import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum BarcodeFormat {
  PNG = 'png',
  SVG = 'svg',
  JSON = 'json',
}

export enum BarcodeSymbology {
  CODE128 = 'code128',
  EAN13 = 'ean13',
  UPCA = 'upca',
  CODE39 = 'code39',
  QRCODE = 'qrcode',
}

export class GenerateBarcodeQueryDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsEnum(BarcodeFormat)
  format?: BarcodeFormat = BarcodeFormat.PNG;

  @IsOptional()
  @IsEnum(BarcodeSymbology)
  bcid?: BarcodeSymbology = BarcodeSymbology.CODE128;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  scale?: number = 3;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(50)
  height?: number = 10;

  @IsOptional()
  includetext?: boolean = true;
}

export class GenerateQrQueryDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsEnum(BarcodeFormat)
  format?: BarcodeFormat = BarcodeFormat.PNG;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(1000)
  width?: number = 300;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  margin?: number = 2;
}

export class LabelQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  copies?: number = 1;

  @IsOptional()
  includePrice?: boolean = true;

  @IsOptional()
  includeQr?: boolean = true;
}
