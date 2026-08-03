import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export const USER_ROLES = ['ADMIN', 'SELLER', 'STOCK_MANAGER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom utilisateur est requis' })
  userName!: string;

  @IsEmail({}, { message: 'Veuillez entrer une adresse email valide' })
  email!: string;

  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères',
  })
  password!: string;

  @IsIn(USER_ROLES, { message: 'Le rôle sélectionné est invalide' })
  role!: UserRole;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}
