import { Type } from 'class-transformer';
import { SpecialOfferType, SpecialOfferUnit } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateSpecialOfferDto {
  @IsString()
  @IsNotEmpty({ message: "Le libelle de l'offre est obligatoire." })
  @Matches(/\S/, { message: "Le libelle de l'offre est obligatoire." })
  label!: string;

  @IsDateString({}, { message: 'La date de debut est invalide.' })
  startDateTime!: string;

  @IsDateString({}, { message: 'La date de fin est invalide.' })
  endDateTime!: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "La valeur de l'offre est invalide." },
  )
  @Min(0, { message: "La valeur de l'offre doit etre positive." })
  @IsOptional()
  value?: number;

  @IsEnum(SpecialOfferUnit, { message: "L'unite de l'offre est invalide." })
  @IsOptional()
  unit?: SpecialOfferUnit;

  @Type(() => Number)
  @IsInt({ message: "La quantite d'achat est invalide." })
  @Min(1, { message: "La quantite d'achat doit etre superieure a 0." })
  @IsOptional()
  buyQuantity?: number;

  @Type(() => Number)
  @IsInt({ message: 'La quantite gratuite est invalide.' })
  @Min(1, { message: 'La quantite gratuite doit etre superieure a 0.' })
  @IsOptional()
  freeQuantity?: number;

  @IsEnum(SpecialOfferType, { message: "Le type de l'offre est invalide." })
  type!: SpecialOfferType;
}
