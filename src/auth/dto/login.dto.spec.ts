import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('returns clear messages when email and password are empty', async () => {
    const loginDto = new LoginDto();
    loginDto.email = '';
    loginDto.password = '';

    const errors = await validate(loginDto);
    const messages = getConstraintMessages(errors);

    expect(messages).toContain("L'adresse email est obligatoire.");
    expect(messages).toContain('Le mot de passe est obligatoire.');
    expect(messages).not.toContain("L'adresse email est invalide.");
  });

  it('returns a clear message when email format is invalid', async () => {
    const loginDto = new LoginDto();
    loginDto.email = 'not-an-email';
    loginDto.password = 'Password123!';

    const errors = await validate(loginDto);
    const messages = getConstraintMessages(errors);

    expect(messages).toEqual(["L'adresse email est invalide."]);
  });
});

function getConstraintMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}
