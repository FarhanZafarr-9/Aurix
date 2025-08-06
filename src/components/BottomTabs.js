import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import {
    Text,
    View,
    Animated,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Platform,
    Easing
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

import Folders from '../screens/Folders';
import History from '../screens/History';
import Settings from '../screens/Settings';

const Tab = createBottomTabNavigator();
const { width: screenWidth } = Dimensions.get('window');

const screenOptions = {
    headerShown: false,
    tabBarStyle: {
        display: 'none',
    },
};

const CustomTabBar = ({ state, descriptors, navigation }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [activeIndex, setActiveIndex] = useState(0);

    // Animation refs
    const pillPosition = useRef(new Animated.Value(0)).current;
    const pillScale = useRef(new Animated.Value(1)).current;
    const textOpacity = useRef(new Animated.Value(1)).current;
    const iconScale = useRef(new Animated.Value(1)).current;

    const highlightAnimations = useRef(
        state.routes.map(() => new Animated.Value(0))
    ).current;

    const styles = useMemo(() => StyleSheet.create({
        // Tab bar background container (flush with bottom, no rounded corners)
        bgContainer: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 55,
            zIndex: 1000,
            elevation: Platform.OS === 'android' ? 8 : 0,
        },

        // Inner tab bar container (no radius, full-width)
        container: {
            flexDirection: 'row',
            backgroundColor: colors.header,
            borderColor: colors.border,
            borderTopWidth: .75,
            alignItems: 'center',
            height: 55,
            paddingHorizontal: 12,
            position: 'relative',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
            elevation: 8,
        },

        // Each tab wrapper
        tab: {
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            zIndex: 2,
        },

        // Content inside each tab (icon + optional label)
        tabContent: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderRadius: 12,
            minHeight: 35,
        },

        iconContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            height: 24,
        },

        labelContainer: {
            marginLeft: 6,
            alignItems: 'center',
        },

        tabText: {
            color: colors.text,
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 0.3,
        },

        // Active pill
        pill: {
            position: 'absolute',
            height: 40,
            backgroundColor: colors.highlight,
            top: 7,
            borderRadius: 12,
            zIndex: 1,
            borderWidth: 0.5,
            borderColor: colors.border,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
        },
    }), [colors]);

    // Precise calculations
    const containerPadding = 12;
    const pillMargin = 4;
    const availableWidth = screenWidth - 80;
    const tabWidth = availableWidth / state.routes.length;
    const pillWidth = tabWidth - (pillMargin * 2);
    const showText = screenWidth > 420 || state.routes.length < 4;
    const iconSize = screenWidth < 420 ? 20 : 22;

    useEffect(() => {
        setActiveIndex(state.index);

        // Calculate pill position with proper margins
        const pillOffset = pillMargin + (state.index * tabWidth) + 40;

        // Animate all highlights
        const animations = highlightAnimations.map((animation, index) => {
            return Animated.timing(animation, {
                toValue: state.index === index ? 1 : 0,
                duration: 250,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
                useNativeDriver: false,
            });
        });

        Animated.parallel([
            // Pill animation
            Animated.spring(pillPosition, {
                toValue: pillOffset,
                useNativeDriver: false,
                tension: 120,
                friction: 9,
            }),
            Animated.sequence([
                Animated.timing(pillScale, {
                    toValue: 0.96,
                    duration: 80,
                    useNativeDriver: false,
                }),
                Animated.timing(pillScale, {
                    toValue: 1,
                    duration: 120,
                    useNativeDriver: false,
                }),
            ]),
            // Text and icon animations
            Animated.timing(textOpacity, {
                toValue: 1,
                duration: 200,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
                useNativeDriver: true,
            }),
            Animated.timing(iconScale, {
                toValue: 0.9,
                duration: 200,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
                useNativeDriver: true,
            }),
            ...animations
        ]).start();
    }, [state.index, tabWidth, pillWidth]);

    const handleTabPress = (route, index) => {
        const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
        });

        if (!event.defaultPrevented) {
            textOpacity.setValue(0);
            navigation.navigate(route.name);
        }
    };

    const getIconName = (routeName) => {
        switch (routeName) {
            case 'Folders':
                return 'folder';
            case 'History':
                return 'time';
            case 'Settings':
                return 'settings';
            default:
                return 'ellipse';
        }
    };

    const getIconOutline = (routeName) => {
        switch (routeName) {
            case 'Folders':
                return 'folder-outline';
            case 'History':
                return 'time-outline';
            case 'Settings':
                return 'settings-outline';
            default:
                return 'ellipse-outline';
        }
    };

    return (
        <View style={styles.bgContainer}>
            <View style={styles.container}>
                {/* Animated pill background */}
                <Animated.View
                    style={[
                        styles.pill,
                        {
                            width: pillWidth,
                            backgroundColor: highlightAnimations[state.index].interpolate({
                                inputRange: [0, 1],
                                outputRange: ['transparent', '#ffffff08']
                            }),
                            borderColor: highlightAnimations[state.index].interpolate({
                                inputRange: [0, 1],
                                outputRange: ['transparent', 'rgba(255, 255, 255, 0.12)']
                            }),
                            transform: [
                                { translateX: pillPosition },
                                { scale: pillScale }
                            ],
                        },
                    ]}
                />

                {/* Tab items */}
                {state.routes.map((route, index) => {
                    const isFocused = state.index === index;
                    const iconName = getIconName(route.name);
                    const iconOutline = getIconOutline(route.name);

                    return (
                        <TouchableOpacity
                            key={route.key}
                            style={[
                                styles.tab,
                                {
                                    width: tabWidth,
                                    flex: isFocused ? (showText ? 1.5 : 1.2) : 1,
                                }
                            ]}
                            onPress={() => handleTabPress(route, index)}
                            activeOpacity={isFocused ? 1 : 0.75}
                        >
                            <Animated.View style={styles.tabContent}>
                                <Animated.View
                                    style={[
                                        styles.iconContainer,
                                        {
                                            transform: [{ scale: isFocused ? iconScale : 1 }]
                                        }
                                    ]}
                                >
                                    <Ionicons
                                        name={isFocused ? iconName : iconOutline}
                                        size={iconSize}
                                        color={isFocused ? colors.text : colors.textSecondary}
                                    />
                                </Animated.View>

                                {/* Show label only when focused and showText is true */}
                                {isFocused && showText && (
                                    <Animated.View
                                        style={[
                                            styles.labelContainer,
                                            {
                                                opacity: textOpacity,
                                                transform: [{
                                                    translateX: textOpacity.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [-10, 0],
                                                    })
                                                }],
                                            }
                                        ]}
                                    >
                                        <Text
                                            style={styles.tabText}
                                            numberOfLines={1}
                                        >
                                            {route.name.slice(0, 9)}
                                        </Text>
                                    </Animated.View>
                                )}
                            </Animated.View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

export default function BottomTabs() {
    const { colors } = useTheme();

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
    }), [colors]);

    return (
        <View style={styles.container}>
            <Tab.Navigator
                screenOptions={screenOptions}
                tabBar={(props) => <CustomTabBar {...props} />}
            >
                <Tab.Screen
                    name="Folders"
                    component={Folders}
                    options={{
                        tabBarLabel: 'Folders',
                        tabBarIcon: ({ focused }) => (
                            <Ionicons
                                name={focused ? 'folder' : 'folder-outline'}
                                size={22}
                                color={focused ? colors.text : colors.textSecondary}
                            />
                        ),
                    }}
                />
                <Tab.Screen
                    name="History"
                    component={History}
                    options={{
                        tabBarLabel: 'History',
                        tabBarIcon: ({ focused }) => (
                            <Ionicons
                                name={focused ? 'time' : 'time-outline'}
                                size={22}
                                color={focused ? colors.text : colors.textSecondary}
                            />
                        ),
                    }}
                />
                <Tab.Screen
                    name="Settings"
                    component={Settings}
                    options={{
                        tabBarLabel: 'Settings',
                        tabBarIcon: ({ focused }) => (
                            <Ionicons
                                name={focused ? 'settings' : 'settings-outline'}
                                size={22}
                                color={focused ? colors.text : colors.textSecondary}
                            />
                        ),
                    }}
                />
            </Tab.Navigator>
        </View>
    );
}