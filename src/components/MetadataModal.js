import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';

const { width, height } = Dimensions.get('window');

export default function MetadataModal({ visible, asset, onClose, onShare, fileSize = null }) {
    if (!asset) return null;

    const formatDate = (timestamp) => {
        const D = new Date(timestamp);
        const day = String(D.getDate()).padStart(2, '0');
        const month = String(D.getMonth() + 1).padStart(2, '0');
        const year = D.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const parts = asset.uri.split('/');
    const folderName = parts[parts.length - 3] + '/' + parts[parts.length - 2];

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.metadataContainer}>
                    <View style={styles.metadataHeader}>
                        <Text style={styles.metadataTitle}>Media Info</Text>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                        >
                            <Ionicons name="close" size={20} color="#888" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.metadataContent}>
                        <View style={styles.metadataRow}>
                            <Text style={styles.metadataLabel}>Name</Text>
                            <Text style={styles.metadataValue}>{asset.filename}</Text>
                        </View>

                        <View style={styles.metadataRow}>
                            <Text style={styles.metadataLabel}>Folder</Text>
                            <Text style={styles.metadataValue}>{folderName}</Text>

                        </View>

                        <View style={styles.metadataRow}>
                            <Text style={styles.metadataLabel}>Type</Text>
                            <Text style={styles.metadataValue}>
                                {asset.mediaType === MediaLibrary.MediaType.video ? 'Video' : 'Photo'}
                            </Text>
                        </View>

                        <View style={styles.metadataRow}>
                            <Text style={styles.metadataLabel}>Size</Text>
                            <Text style={styles.metadataValue}>{fileSize != null ? (fileSize / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'}</Text>
                        </View>

                        <View style={styles.metadataRow}>
                            <Text style={styles.metadataLabel}>Dimensions</Text>
                            <Text style={styles.metadataValue}>
                                {asset.width} × {asset.height}
                            </Text>
                        </View>

                        <View style={styles.metadataRow}>
                            <Text style={styles.metadataLabel}>Created</Text>
                            <Text style={styles.metadataValue}>{formatDate(asset.creationTime)}</Text>
                        </View>


                    </View>

                    <TouchableOpacity
                        style={styles.shareButton}
                        onPress={() => {
                            onClose();
                            onShare(asset);
                        }}
                    >
                        <Ionicons name="share-social" size={16} color="#888" />
                        <Text style={styles.shareButtonText}>Share</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    metadataContainer: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 20,
        margin: 20,
        minWidth: width - 40,
        maxHeight: height * 0.8,
        borderWidth: 1,
        borderColor: '#55555555',
    },
    metadataHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#55555555',
    },
    metadataTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    closeButton: {
        padding: 4,
        borderRadius: 4,
    },
    metadataContent: {
        marginBottom: 20,
    },
    metadataRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: '#2a2a2a',
    },
    metadataLabel: {
        color: '#888',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    metadataValue: {
        color: '#fff',
        fontSize: 14,
        flex: 2,
        textAlign: 'right',
        height: 20
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff08',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#55555555',
    },
    shareButtonText: {
        color: '#ddd',
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 8,
    },
});