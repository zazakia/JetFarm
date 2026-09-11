export let COMPANY_NAME = 'JetFarm';
export let COMPANY_NAME_FULL = 'JetFarm';
export let COMPANY_PRODUCT_NAME = `${COMPANY_NAME} LMS`;
export let COMPANY_EMAIL_PLACEHOLDER = 'user@jetfarm.com';

export function setBrandData(name: string, fullName: string) {
    COMPANY_NAME = name;
    COMPANY_NAME_FULL = fullName;
    COMPANY_PRODUCT_NAME = `${name} LMS`;
    COMPANY_EMAIL_PLACEHOLDER = `user@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
}
