import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { USER_ROLES, type UserRole } from './create-user.dto';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  userName?: string;

  @IsEmail({}, { message: 'Veuillez entrer une adresse email valide' })
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caracteres',
  })
  @IsOptional()
  password?: string;

  @IsIn(USER_ROLES, { message: 'Le role selectionne est invalide' })
  @IsOptional()
  role?: UserRole;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}
