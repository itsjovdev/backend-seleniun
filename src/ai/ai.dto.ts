//C:\Users\jov\Documents\proyectos\seleniun\backend\api\src\ai\ai.dto.ts

import { IsString, IsOptional, IsNumber } from 'class-validator';

export class GenerateDto {
  @IsString()
  prompt!: string;

  @IsOptional() @IsString()
  system?: string;

  @IsOptional() @IsNumber()
  temperature?: number;
}
