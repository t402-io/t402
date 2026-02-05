/**
 * Tether WDK Version Compatibility Tracking
 *
 * Tracks compatibility between @t402/wdk and @tetherto/wdk versions.
 */

/**
 * WDK compatibility information
 */
export const WDK_COMPATIBILITY = {
  /** Minimum supported @tetherto/wdk version */
  minVersion: '1.0.0-beta.0',
  /** Versions that have been tested */
  testedVersions: ['1.0.0-beta.3', '1.0.0-beta.4'],
  /** Feature availability by version */
  features: {
    signTypedData: '1.0.0-beta.0',
    estimateGas: '1.0.0-beta.3',
    multiChainWallets: '1.0.0-beta.0',
    bridgeProtocol: '1.0.0-beta.3',
  },
} as const

/**
 * Result of a WDK compatibility check
 */
export interface CompatibilityResult {
  /** Whether the version is compatible */
  compatible: boolean
  /** Warning messages for potential issues */
  warnings: string[]
}

/**
 * Parse a semver version string into comparable parts.
 * Supports pre-release tags like -beta.0
 */
function parseVersion(version: string): {
  major: number
  minor: number
  patch: number
  prerelease: string
} {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
  if (!match) {
    return { major: 0, minor: 0, patch: 0, prerelease: '' }
  }

  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
    prerelease: match[4] ?? '',
  }
}

/**
 * Compare two semver versions.
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
function compareVersions(a: string, b: string): number {
  const va = parseVersion(a)
  const vb = parseVersion(b)

  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1
  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1
  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1

  // Pre-release versions have lower precedence than release
  if (va.prerelease && !vb.prerelease) return -1
  if (!va.prerelease && vb.prerelease) return 1
  if (va.prerelease && vb.prerelease) {
    return va.prerelease < vb.prerelease ? -1 : va.prerelease > vb.prerelease ? 1 : 0
  }

  return 0
}

/**
 * Check if a @tetherto/wdk version is compatible with @t402/wdk.
 *
 * @param version - The @tetherto/wdk version to check
 * @returns Compatibility result with warnings
 *
 * @example
 * ```typescript
 * import { checkWdkCompatibility } from '@t402/wdk';
 *
 * const result = checkWdkCompatibility('1.0.0-beta.4');
 * if (!result.compatible) {
 *   console.error('Incompatible WDK version');
 * }
 * result.warnings.forEach(w => console.warn(w));
 * ```
 */
export function checkWdkCompatibility(version: string): CompatibilityResult {
  const warnings: string[] = []

  // Check minimum version
  if (compareVersions(version, WDK_COMPATIBILITY.minVersion) < 0) {
    return {
      compatible: false,
      warnings: [
        `@tetherto/wdk ${version} is below minimum supported version ${WDK_COMPATIBILITY.minVersion}`,
      ],
    }
  }

  // Check if version has been tested
  const isTested = (WDK_COMPATIBILITY.testedVersions as readonly string[]).includes(version)
  if (!isTested) {
    warnings.push(
      `@tetherto/wdk ${version} has not been explicitly tested. ` +
        `Tested versions: ${WDK_COMPATIBILITY.testedVersions.join(', ')}`,
    )
  }

  // Check feature-specific compatibility
  for (const [feature, minFeatureVersion] of Object.entries(WDK_COMPATIBILITY.features)) {
    if (compareVersions(version, minFeatureVersion) < 0) {
      warnings.push(`Feature '${feature}' requires @tetherto/wdk >= ${minFeatureVersion}`)
    }
  }

  return { compatible: true, warnings }
}
