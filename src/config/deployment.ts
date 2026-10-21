export type DeploymentMode = 'agri' | 'cooperative' | 'crispy-king';

let runtimeOverride: DeploymentMode | null = null;

/**
 * Returns the current deployment mode.
 * Priority: runtime override > EXPO_PUBLIC_BUSINESS_TYPE > EXPO_PUBLIC_DEPLOYMENT_MODE > 'agri'
 *
 * On the agribusiness-only branch 'agri' is the fallback: the POS and cooperative screens this
 * fallback used to select are physically deleted, so an unset env must not resolve to a mode whose
 * features do not exist.
 */
export function getDeploymentMode(): DeploymentMode {
    if (runtimeOverride !== null) {
        return runtimeOverride;
    }

    const envMode = (process.env.EXPO_PUBLIC_BUSINESS_TYPE || process.env.EXPO_PUBLIC_DEPLOYMENT_MODE)?.trim().toLowerCase();
    if (envMode === 'agri' || envMode === 'agribusiness') {
        return 'agri';
    }
    if (envMode === 'cooperative' || envMode === 'coop') {
        return 'cooperative';
    }
    if (envMode === 'crispy-king') {
        return 'crispy-king';
    }

    return 'agri';
}

/**
 * Checks if the system is running in Agribusiness mode.
 */
export function isAgri(): boolean {
    return getDeploymentMode() === 'agri';
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
