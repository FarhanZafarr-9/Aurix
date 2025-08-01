import React, { useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Image, Dimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';

const { width, height } = Dimensions.get('window');

export default function PreviewModal({
    visible,
    asset,
    onClose = () => { },
    fullscreen = true,
    showControls = true,
}) {
    if (!asset) return null;

    const isVideo = asset.mediaType === MediaLibrary.MediaType.video;

    const player = useVideoPlayer(
        isVideo ? asset.uri : undefined,
        (p) => {
            p.shouldPlay = visible;
            p.isLooping = true;
        }
    );

    useEffect(() => {
        if (!player || !isVideo) return;

        try {
            if (visible) {
                player.play();
            } else {
                player.pause();
                player.seekTo(0);
            }
        } catch {
            console.warn('Player method call failed—possibly released');
        }

        return () => {
            try {
                player.pause();
                player.seekTo(0);
            } catch {
                // no-op
            }
        };
    }, [visible, player]);

    const containerStyle = fullscreen
        ? styles.fullscreenContainer
        : styles.embeddedContainer;

    const mediaStyle = fullscreen
        ? styles.fullscreenMedia
        : styles.embeddedMedia;

    return (
        <Modal
            visible={visible}
            transparent={fullscreen}
            animationType={fullscreen ? 'fade' : 'none'}
            onRequestClose={onClose}
        >
            <View style={containerStyle}>
                {isVideo ? (
                    <TouchableOpacity
                        style={mediaStyle}
                        activeOpacity={1}
                    >
                        {player && (
                            <VideoView
                                player={player}
                                style={mediaStyle}
                                contentFit="contain"
                                nativeControls={showControls}
                            />
                        )}
                    </TouchableOpacity>
                ) : (
                        <View style={[{borderRadius: 12, overflow: 'hidden', backgroundColor: '#101010',}]}>
                            <Image
                                source={{ uri: asset.uri }}
                                style={mediaStyle}
                                resizeMode="contain"

                            />
                    </View>
                )}

                {fullscreen && (
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onClose}
                    >
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    fullscreenContainer: {
        flex: 1,
        backgroundColor: '#090909',
        justifyContent: 'center',
        alignItems: 'center',

    },
    embeddedContainer: {
        flex: 1,
        backgroundColor: '#161616',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    fullscreenMedia: {
        width: width * 0.95,
        height: height * 0.95,
        borderRadius: 12,
        backgroundColor: '#161616',
        overflow: 'hidden',
        borderColor: '#55555555',
        borderWidth: 0.5,
        borderStyle: 'dashed'
    },
    embeddedMedia: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
 