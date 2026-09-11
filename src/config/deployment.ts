export type DeploymentMode = 'crispy-king' | 'cooperative';

let runtimeOverride: DeploymentMode | null = null;

/**
 * Returns the current deployment mode.
 * Priority: runtime override > EXPO_PUBLIC_DEPLOYMENT_MODE > 'crispy-king' (default)
 */
export function getDeploymentMode(): DeploymentMode {
    if (runtimeOverride !== null) {
        return runtimeOverride;
    }

    const envMode = process.env.EXPO_PUBLIC_DEPLOYMENT_MODE?.trim().toLowerCase();
    if (envMode === 'cooperative') {
        return 'cooperative';
    }

    return 'crispy-king';
}

/**
 * Checks if the system is running in Crispy King mode.
 */
export function isCrispyKing(): boolean {
    return getDeploymentMode() === 'crispy-king';
}

/**
 * Checks if the system is running in Multi-Purpose Cooperative mode.
 */
export function isCooperative(): boolean {
    return getDeploymentMode() === 'cooperative';
}

/**
 * Sets a runtime override for the deployment mode (useful for testing or dynamic switching).
 */
export function setDeploymentMode(mode: DeploymentMode): void {
    runtimeOverride = mode;
}

/**
 * Resets the runtime override back to environment-based detection.
 */
export function resetDeploymentMode(): void {
    runtimeOverride = null;
}
