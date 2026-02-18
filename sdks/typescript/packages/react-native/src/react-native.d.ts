/**
 * Minimal React Native type declarations.
 *
 * These are provided so the package can be built and type-checked without
 * requiring react-native as a devDependency (which brings heavy native deps).
 * In a real React Native project, @types/react-native provides full types.
 */
declare module 'react-native' {
  import type { ComponentType, ReactNode } from 'react'

  export interface ViewStyle {
    [key: string]: unknown
  }

  export interface TextStyle {
    [key: string]: unknown
  }

  export type StyleProp<T> = T | T[] | (T | false | null | undefined)[] | undefined

  export interface ViewProps {
    style?: StyleProp<ViewStyle>
    children?: ReactNode
    [key: string]: unknown
  }

  export interface TextProps {
    style?: StyleProp<TextStyle>
    children?: ReactNode
    [key: string]: unknown
  }

  export interface TouchableOpacityProps {
    style?: StyleProp<ViewStyle>
    onPress?: () => void
    disabled?: boolean
    children?: ReactNode
    [key: string]: unknown
  }

  export interface ActivityIndicatorProps {
    size?: 'small' | 'large'
    color?: string
    [key: string]: unknown
  }

  export interface ModalProps {
    visible?: boolean
    animationType?: 'none' | 'slide' | 'fade'
    transparent?: boolean
    onRequestClose?: () => void
    children?: ReactNode
    [key: string]: unknown
  }

  export const View: ComponentType<ViewProps>
  export const Text: ComponentType<TextProps>
  export const TouchableOpacity: ComponentType<TouchableOpacityProps>
  export const ActivityIndicator: ComponentType<ActivityIndicatorProps>
  export const Modal: ComponentType<ModalProps>

  export const StyleSheet: {
    create: <T extends Record<string, ViewStyle | TextStyle>>(styles: T) => T
  }

  export const Platform: {
    OS: 'ios' | 'android' | 'web'
    select: <T>(specifics: { ios?: T; android?: T; default?: T }) => T | undefined
  }
}
