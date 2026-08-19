import { IsDateString, IsOptional, Matches } from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class DateRangeQueryDto {
  @Matches(DATE_ONLY_PATTERN, {
    message: 'La date de début doit respecter le format AAAA-MM-JJ',
  })
  @IsDateString(
    { strict: true },
    { message: 'La date de début doit être une date valide' },
  )
  @IsOptional()
  startDate?: string;

  @Matches(DATE_ONLY_PATTERN, {
    message: 'La date de fin doit respecter le format AAAA-MM-JJ',
  })
  @IsDateString(
    { strict: true },
    { message: 'La date de fin doit être une date valide' },
  )
  @IsOptional()
  endDate?: string;
}
