/**
 * Mock for react-native module used in unit tests.
 *
 * Provides stub implementations of the React Native components and APIs
 * used by @t402/react-native so tests can run in a Node.js environment.
 */

export const View = 'View'
export const Text = 'Text'
export const TouchableOpacity = 'TouchableOpacity'
export const ActivityIndicator = 'ActivityIndicator'
export const Modal = 'Modal'

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
}

export const Platform = {
  OS: 'ios',
  select: (specifics: Record<string, unknown>) => specifics.ios ?? specifics.default,
}
