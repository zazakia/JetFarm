const { listObsoleteApkObjectNames } = require('../apkStorageRetention');

describe('apkStorageRetention', () => {
    it('keeps only jetfarm.apk and deletes all versioned APKs', () => {
        const obsolete = listObsoleteApkObjectNames([
            'jetfarm.apk',
            'jetfarm-v0.1.1.apk',
            'jetfarm-v0.1.3.apk',
            'readme.txt',
        ]);

        expect(obsolete).toEqual([
            'jetfarm-v0.1.1.apk',
            'jetfarm-v0.1.3.apk',
        ]);
    });

    it('returns empty when only the latest APK exists', () => {
        expect(listObsoleteApkObjectNames(['jetfarm.apk'])).toEqual([]);
    });
});
