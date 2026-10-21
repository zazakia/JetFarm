export let COMPANY_NAME = 'Agri-One';
export let COMPANY_NAME_FULL = 'Agri-One';
export let COMPANY_PRODUCT_NAME = `${COMPANY_NAME} Farm Operations`;
export let COMPANY_EMAIL_PLACEHOLDER = 'user@agri-one.app';

export function setBrandData(name: string, fullName: string) {
    COMPANY_NAME = name;
    COMPANY_NAME_FULL = fullName;
    COMPANY_PRODUCT_NAME = `${name} Farm Operations`;
    COMPANY_EMAIL_PLACEHOLDER = `user@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.app`;
}
