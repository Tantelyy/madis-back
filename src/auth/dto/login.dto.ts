import { IsNotEmpty, IsString, IsEmail } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: "L'adresse email est obligatoire." })
  @IsEmail({}, { message: "L'adresse email est invalide." })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  password!: string;
}
