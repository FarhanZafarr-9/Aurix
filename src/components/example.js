<MetadataModal
    visible={showMetadata}
    asset={selectedAsset}
    onClose={() => setShowMetadata(false)}
    onShare={handleShare}
/>


import MetadataModal from './MetadataModal';
import * as Sharing from 'expo-sharing';
const [showMetadata, setShowMetadata] = useState(false);
const [selectedAsset, setSelectedAsset] = useState(null);

const showAssetMetadata = useCallback((asset) => {
    setSelectedAsset(asset);
    setShowMetadata(true);
}, []);

// Enhanced share handler with asset validation
const handleShare = async (asset) => {
    try {
        if (!(await Sharing.isAvailableAsync())) {
            setShowPermissionModal(true);
            return;
        }

        const hasPermission = await requestSharingPermission();
        if (!hasPermission) {
            setShowPermissionModal(true);
            return;
        }

        // Get asset info without EXIF to avoid permission issues
        const assetInfo = await MediaLibrary.getAssetInfoAsync(asset, {
            shouldDownloadFromNetwork: true,
        });

        if (assetInfo.localUri || assetInfo.uri) {
            await Sharing.shareAsync(assetInfo.localUri || assetInfo.uri, {
                mimeType: assetInfo.mediaType === 'video' ? 'video/*' : 'image/*',
            });
        }
    } catch (error) {
        console.log('Sharing error:', error);
        if (error.message?.includes('Asset not found') || error.message?.includes('deleted')) {
            setAlertContent({
                title: 'Error',
                message: 'This media file no longer exists',
                onConfirm: () => setAlertVisible(false),
            });
            setAlertVisible(true);

        } else if (error.message?.includes('ACCESS_MEDIA_LOCATION')) {
            setAlertContent({
                title: 'Permission Required',
                message: 'Location permission is needed to share photos with location data. Share without location?',
                onConfirm: async () => {
                    setAlertVisible(false);
                    const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
                    if (assetInfo.localUri || assetInfo.uri) {
                        await Sharing.shareAsync(assetInfo.localUri || assetInfo.uri);
                    }
                },
                onCancel: () => setAlertVisible(false),
            });
            setAlertVisible(true);

        } else {
            setAlertContent({
                title: 'Error',
                message: 'Failed to share Media',
                onConfirm: () => setAlertVisible(false),
            });
            setAlertVisible(true);
        }
    }
};
