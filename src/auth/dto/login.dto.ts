import {
  IsNotEmpty,
  IsString,
  registerDecorator,
  ValidationOptions,
  isEmail,
} from 'class-validator';

function IsEmailFormat(validationOptions: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isEmailFormat',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === null || value === undefined || value === '') {
            return true;
          }

          return typeof value === 'string' && isEmail(value);
        },
        defaultMessage(): string {
          return "L'adresse email est invalide.";
        },
      },
    });
  };
}

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: "L'adresse email est obligatoire." })
  @IsEmailFormat({ message: "L'adresse email est invalide." })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  password!: string;
}
