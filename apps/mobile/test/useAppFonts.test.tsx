import { renderHook } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { useAppFonts } from '../src/theme/useAppFonts';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));

const mockedUseFonts = jest.mocked(useFonts);

describe('useAppFonts', () => {
  it('is not ready while the fonts load', async () => {
    mockedUseFonts.mockReturnValue([false, null]);

    const { result } = await renderHook(useAppFonts);

    expect(result.current).toBe(false);
  });

  it('is ready once the fonts are loaded', async () => {
    mockedUseFonts.mockReturnValue([true, null]);

    const { result } = await renderHook(useAppFonts);

    expect(result.current).toBe(true);
  });

  it('is ready when a font fails to load, so the app opens in the system font', async () => {
    mockedUseFonts.mockReturnValue([false, new Error('font missing')]);

    const { result } = await renderHook(useAppFonts);

    expect(result.current).toBe(true);
  });
});
