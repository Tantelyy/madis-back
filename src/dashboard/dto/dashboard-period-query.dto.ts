import { Transform, type TransformFnParams } from 'class-transformer';
import { IsDateString, IsInt, Max, Min } from 'class-validator';

export class DashboardPeriodQueryDto {
  @IsDateString({ strict: true }, { message: 'La date de début est invalide.' })
  from!: string;

  @IsDateString({ strict: true }, { message: 'La date de fin est invalide.' })
  to!: string;

  @Transform(({ value }: TransformFnParams) => Number(value))
  @IsInt({ message: 'Le fuseau horaire est invalide.' })
  @Min(-840, { message: 'Le fuseau horaire est invalide.' })
  @Max(840, { message: 'Le fuseau horaire est invalide.' })
  timezoneOffset!: number;
}
