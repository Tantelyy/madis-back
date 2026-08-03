import { Type } from 'class-transformer';
import { SpecialOfferType, SpecialOfferUnit } from '@prisma/client';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
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
  @IsArray({ message: 'Les produits sont invalides.' })
  @ArrayMinSize(1, { message: 'Sélectionnez au moins un produit.' })
  @ArrayUnique({ message: "Un produit ne peut être sélectionné qu'une fois." })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Un produit est invalide.' })
  @Min(1, { each: true, message: 'Un produit est invalide.' })
  productIds!: number[];

  @IsString()
  @IsNotEmpty({ message: "Le libellé de l'offre est obligatoire." })
  @Matches(/\S/, { message: "Le libellé de l'offre est obligatoire." })
  label!: string;

  @IsDateString({}, { message: 'La date de début est invalide.' })
  startDateTime!: string;

  @IsDateString({}, { message: 'La date de fin est invalide.' })
  endDateTime!: string;

  @IsDateString({}, { message: "La date limite d'expiration est invalide." })
  @IsOptional()
  limitDate?: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: "La valeur de l'offre est invalide." },
  )
  @Min(0, { message: "La valeur de l'offre doit être positive." })
  @IsOptional()
  value?: number;

  @IsEnum(SpecialOfferUnit, { message: "L'unité de l'offre est invalide." })
  @IsOptional()
  unit?: SpecialOfferUnit;

  @Type(() => Number)
  @IsInt({ message: "La quantité d'achat est invalide." })
  @Min(1, { message: "La quantité d'achat doit être supérieure à 0." })
  @IsOptional()
  buyQuantity?: number;

  @Type(() => Number)
  @IsInt({ message: 'La quantité gratuite est invalide.' })
  @Min(1, { message: 'La quantité gratuite doit être supérieure à 0.' })
  @IsOptional()
  freeQuantity?: number;

  @IsEnum(SpecialOfferType, { message: "Le type de l'offre est invalide." })
  type!: SpecialOfferType;
}
