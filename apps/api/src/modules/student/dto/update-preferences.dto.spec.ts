import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdatePreferencesDto } from './update-preferences.dto';

describe('UpdatePreferencesDto', () => {
  it('should accept valid theme values', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, { theme: 'dark' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject invalid theme values', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, { theme: 'invalid' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  it('should accept empty dto', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept boolean notifications', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, { notifications: true });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject non-boolean notifications', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, { notifications: 'yes' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept valid language string', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, { language: 'es' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept multiple valid fields', async () => {
    const dto = plainToInstance(UpdatePreferencesDto, {
      theme: 'dark',
      language: 'en',
      notifications: false,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
