import React, { useEffect, useState, useRef, memo } from 'react';
import { TouchableOpacity, Image, View, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';

const { width, height } = Dimensions.get('window');

// Global thumbnail cache to avoid regenerating the same thumbnails
const thumbnailCache = new Map();
const pendingRequests = new Map();

// Queue system for thumbnail generation
class ThumbnailQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.maxConcurrent = 2; // Limit concurrent thumbnail generations
        this.activeRequests = 0;
    }

    add(request) {
        this.queue.push(request);
        this.process();
    }

    async process() {
        if (this.processing || this.activeRequests >= this.maxConcurrent) {
            return;
        }

        const request = this.queue.shift();
        if (!request) {
            return;
        }

        this.processing = true;
        this.activeRequests++;

        try {
            await request.execute();
        } catch (error) {
            console.log('Thumbnail queue error:', error);
        } finally {
            this.activeRequests--;
            this.processing = false;

            // Process next item in queue
            if (this.queue.length > 0) {
                setTimeout(() => this.process(), 10);
            }
        }
    }
}

const thumbnailQueue = new ThumbnailQueue();

const Thumbnail = memo(({
    item,
    onPress,
    onLongPress,
    priority = 'normal',
    lazy = false,
    index = 0
}) => {
    const [thumbnailUri, setThumbnailUri] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [shouldLoad, setShouldLoad] = useState(!lazy);
    const [thumbnailError, setThumbnailError] = useState(false);
    const mountedRef = useRef(true);
    const requestIdRef = useRef(null);

    const isVideo = item.mediaType === MediaLibrary.MediaType.video;
    const cacheKey = `${item.id}_${item.modificationTime}`;

    useEffect(() => {
        mountedRef.current = true;

        // Check cache first
        if (isVideo && thumbnailCache.has(cacheKey)) {
            const cachedUri = thumbnailCache.get(cacheKey);
            if (cachedUri === 'error') {
                setThumbnailError(true);
            } else {
                setThumbnailUri(cachedUri);
            }
            return;
        }

        // Implement progressive loading with much shorter delays
        if (lazy && !shouldLoad) {
            const delay = priority === 'high' ? 10 :
                isVideo ? 20 + (index * 2) : // Much faster staggering for videos
                    15 + (index * 1);

            const timer = setTimeout(() => {
                if (mountedRef.current) {
                    setShouldLoad(true);
                }
            }, delay);

            return () => clearTimeout(timer);
        }

        return () => {
            mountedRef.current = false;
        };
    }, [lazy, priority, isVideo, index, shouldLoad, cacheKey]);

    // Optimized video thumbnail generation
    useEffect(() => {
        if (!shouldLoad || !isVideo || thumbnailUri || thumbnailError) {
            return;
        }

        // Check if request is already pending
        if (pendingRequests.has(cacheKey)) {
            const existingCallbacks = pendingRequests.get(cacheKey);
            const callbackId = Date.now() + Math.random();

            const callback = {
                id: callbackId,
                execute: (uri, error) => {
                    if (mountedRef.current) {
                        if (error) {
                            setThumbnailError(true);
                        } else {
                            setThumbnailUri(uri);
                        }
                    }
                }
            };

            existingCallbacks.push(callback);

            // Cleanup function for this specific callback
            return () => {
                const callbacks = pendingRequests.get(cacheKey);
                if (callbacks) {
                    const filtered = callbacks.filter(cb => cb.id !== callbackId);
                    if (filtered.length === 0) {
                        pendingRequests.delete(cacheKey);
                    } else {
                        pendingRequests.set(cacheKey, filtered);
                    }
                }
            };
        }

        const requestId = Date.now() + Math.random();
        requestIdRef.current = requestId;
        const callbackId = requestId;

        // Initialize pending request callbacks with ID-based system
        const callback = {
            id: callbackId,
            execute: (uri, error) => {
                if (mountedRef.current && requestIdRef.current === requestId) {
                    if (error) {
                        setThumbnailError(true);
                    } else {
                        setThumbnailUri(uri);
                    }
                }
            }
        };

        pendingRequests.set(cacheKey, [callback]);

        const generateThumbnail = async () => {
            try {
                // Dynamic import only when needed
                const VideoThumbnails = await import('expo-video-thumbnails');

                if (!mountedRef.current || requestIdRef.current !== requestId) {
                    return;
                }

                // Highly optimized thumbnail options for speed
                const thumbnailOptions = {
                    time: 500, // Fixed 0.5 second for consistency and speed
                    quality: priority === 'high' ? 0.3 : 0.2, // Much lower quality for speed
                    // Additional optimizations
                    headers: {},
                };

                const result = await VideoThumbnails.getThumbnailAsync(
                    item.uri,
                    thumbnailOptions
                );

                const callbacks = pendingRequests.get(cacheKey) || [];

                if (result?.uri) {
                    // Cache successful result
                    thumbnailCache.set(cacheKey, result.uri);

                    // Limit cache size to prevent memory issues
                    if (thumbnailCache.size > 200) {
                        const firstKey = thumbnailCache.keys().next().value;
                        thumbnailCache.delete(firstKey);
                    }

                    // Notify all waiting callbacks
                    callbacks.forEach(callback => callback.execute(result.uri, null));
                } else {
                    // Cache error result
                    thumbnailCache.set(cacheKey, 'error');
                    callbacks.forEach(callback => callback.execute(null, true));
                }

                pendingRequests.delete(cacheKey);

            } catch (error) {
                console.log('Fast thumbnail generation error:', error);

                // Cache error and notify callbacks
                thumbnailCache.set(cacheKey, 'error');
                const callbacks = pendingRequests.get(cacheKey) || [];
                callbacks.forEach(callback => callback.execute(null, true));
                pendingRequests.delete(cacheKey);
            }
        };

        // Add to queue with priority handling
        const queueRequest = {
            execute: generateThumbnail,
            priority: priority === 'high' ? 1 : 2,
            index: index
        };

        // High priority items go to front of queue
        if (priority === 'high') {
            thumbnailQueue.queue.unshift(queueRequest);
        } else {
            thumbnailQueue.add(queueRequest);
        }

        return () => {
            requestIdRef.current = null;

            // Clean up this component's specific callback
            const callbacks = pendingRequests.get(cacheKey);
            if (callbacks) {
                const filtered = callbacks.filter(cb => cb.id !== callbackId);
                if (filtered.length === 0) {
                    pendingRequests.delete(cacheKey);
                } else {
                    pendingRequests.set(cacheKey, filtered);
                }
            }
        };
    }, [shouldLoad, isVideo, item.uri, priority, index, thumbnailUri, thumbnailError, cacheKey]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            requestIdRef.current = null;
        };
    }, []);

    const handleImageLoad = () => {
        if (mountedRef.current) {
            setImageLoaded(true);
        }
    };

    const handleImageError = () => {
        if (mountedRef.current) {
            setImageLoaded(false);
            if (isVideo) {
                setThumbnailError(true);
                // Cache the error
                thumbnailCache.set(cacheKey, 'error');
            }
        }
    };

    const handlePress = () => {
        onPress(item);
    };

    const handleLongPress = () => {
        onLongPress(item);
    };

    const renderMedia = () => {
        if (!shouldLoad) {
            return <View style={styles.placeholder} />;
        }

        // Show fallback immediately for failed video thumbnails
        if (isVideo && thumbnailError) {
            return (
                <View style={styles.videoFallback}>
                    <Ionicons name="videocam" size={24} color="#666" />
                </View>
            );
        }

        const uriToUse = isVideo && thumbnailUri
            ? thumbnailUri
            : item.uri;

        return (
            <Image
                source={{ uri: uriToUse }}
                style={styles.thumbnailImage}
                resizeMode="cover"
                onLoad={handleImageLoad}
                onError={handleImageError}
                // Optimized for speed
                priority="normal"
                fadeDuration={50} // Faster fade
                cache="force-cache"
                // Additional performance props
                loadingIndicatorSource={undefined}
                progressiveRenderingEnabled={true}
            />
        );
    };

    return (
        <TouchableOpacity
            style={styles.thumbnail}
            activeOpacity={0.8}
            onPress={handlePress}
            onLongPress={handleLongPress}
        >
            <View style={styles.thumbnailContainer}>
                {renderMedia()}
                {isVideo && shouldLoad && (
                    <View style={styles.videoOverlay}>
                        <Ionicons
                            name="play"
                            size={10}
                            color="#fff"
                        />
                    </View>
                )}
                {/* Simplified loading indicator */}
                {!imageLoaded && shouldLoad && isVideo && !thumbnailError && (
                    <View style={styles.loadingOverlay}>
                        <View style={styles.loadingDot} />
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    thumbnail: {
        width: width / 4,
        height: width / 4,
        padding: 0.5,
    },
    thumbnailContainer: {
        flex: 1,
        position: 'relative',
    },
    thumbnailImage: {
        flex: 1,
        borderRadius: 1,
        backgroundColor: '#111',
    },
    placeholder: {
        flex: 1,
        backgroundColor: '#111',
        borderRadius: 1,
    },
    videoFallback: {
        flex: 1,
        backgroundColor: '#111',
        borderRadius: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoOverlay: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: 6,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 4,
        left: 4,
        width: 8,
        height: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#666',
        opacity: 0.8,
    },
});

Thumbnail.displayName = 'Thumbnail';

export default Thumbnail;