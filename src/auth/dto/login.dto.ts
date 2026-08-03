import {
  IsNotEmpty,
  IsString,
  IsEmail,
  type ValidationArguments,
} from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: "L'adresse email est obligatoire." })
  @IsEmail({}, { message: emailValidationMessage })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  password!: string;
}

function emailValidationMessage(arguments_: ValidationArguments): string {
  return arguments_.value === ''
    ? "L'adresse email est obligatoire."
    : "L'adresse email est invalide.";
}
