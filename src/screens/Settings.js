import React, { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Animated,
    Linking,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../contexts/ThemeContext';
import { useMedia } from '../contexts/MediaContext';
import PickerSheet from '../components/PickerSheet';
import Switch from '../components/Switch';

const APP_VERSION = '1.0.0';

/* ------------------------------------------------------------------ */
/*  Helper Components                                                 */
/* ------------------------------------------------------------------ */

const SectionHeader = memo(({ children }) => {
    const { colors } = useTheme();

    const styles = useMemo(() => StyleSheet.create({
        sectionHeader: {
            paddingVertical: 12,
            paddingHorizontal: 20,

        },
        sectionHeaderText: {
            fontSize: 13,
            fontWeight: 'bold',
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
    }), [colors]);

    return (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{children}</Text>
        </View>
    );
});

const AnimatedCard = memo(({ animatedStyle, children }) => (
    <Animated.View style={animatedStyle}>
        <CardShell>{children}</CardShell>
    </Animated.View>
));

const CardShell = memo(({ children }) => {
    const { colors } = useTheme();

    const styles = useMemo(() => StyleSheet.create({
        card: {
            backgroundColor: 'transparent',
            marginBottom: 15,
            borderRadius: 12,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
        },
    }), [colors]);

    return <View style={styles.card}>{children}</View>;
});

const SettingRow = memo(({
    icon,
    title,
    desc,
    onPress,
    children,
    noBorder,
    disabled,
    extraStyle,
}) => {
    const { colors } = useTheme();

    const styles = useMemo(() => StyleSheet.create({
        settingBlock: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 18,
            paddingBottom: 14,
            paddingHorizontal: 20,
            backgroundColor: colors.surface,
            borderBottomWidth: noBorder ? 0 : 1,
            borderBottomColor: colors.border,
        },
        settingTextBlock: { flex: 1 },
        settingTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 2,
            height: 22,
        },
        settingDesc: {
            fontSize: 13,
            color: colors.textSecondary,
            opacity: 0.85,
            height: 18,
        },
    }), [colors, noBorder]);

    return (
        <TouchableOpacity
            style={[styles.settingBlock, extraStyle]}
            onPress={onPress}
            activeOpacity={disabled ? 1 : 0.7}
            disabled={disabled}
        >
            {icon && (
                <Ionicons
                    name={icon}
                    size={16}
                    color={colors.textTertiary}
                    style={{ marginRight: 15 }}
                />
            )}
            <View style={styles.settingTextBlock}>
                <Text style={styles.settingTitle}>{title}</Text>
                <Text style={styles.settingDesc}>{desc}</Text>
            </View>
            {children}
        </TouchableOpacity>
    );
});

/* ------------------------------------------------------------------ */
/*  Settings Cards                                                    */
/* ------------------------------------------------------------------ */

const AppearanceCard = memo(({ animatedStyle }) => {
    const {
        isDarkMode,
        showMediaCounts,
        hideCompleted,
        compactView,
        toggleDarkMode,
        updateShowMediaCounts,
        updateHideCompleted,
        updateCompactView,
        colors
    } = useTheme();

    return (
        <AnimatedCard animatedStyle={animatedStyle}>
            <SettingRow
                icon="moon-outline"
                title="Dark Mode"
                desc="Use dark theme"
                onPress={toggleDarkMode}
            >
                <Switch
                    value={isDarkMode}
                    onValueChange={toggleDarkMode}
                />
            </SettingRow>

            <SettingRow
                icon="analytics-outline"
                title="Show Media Counts"
                desc="Display media counts in cards"
                onPress={() => updateShowMediaCounts(!showMediaCounts)}
            >
                <Switch
                    value={showMediaCounts}
                    onValueChange={updateShowMediaCounts}
                />
            </SettingRow>

            <SettingRow
                icon="eye-off-outline"
                title="Hide Completed"
                desc="Hide completed folders"
                onPress={() => updateHideCompleted(!hideCompleted)}
            >
                <Switch
                    value={hideCompleted}
                    onValueChange={updateHideCompleted}
                />
            </SettingRow>

            <SettingRow
                icon="contract-outline"
                title="Compact View"
                desc="Use smaller cards"
                noBorder
                onPress={() => updateCompactView(!compactView)}
            >
                <Switch
                    value={compactView}
                    onValueChange={updateCompactView}
                />
            </SettingRow>
        </AnimatedCard>
    );
});

const OrganizationCard = memo(({ animatedStyle }) => {
    const {
        sortMethod,
        autoRefresh,
        showProgress,
        excludedFolders,
        updateSortMethod,
        updateAutoRefresh,
        updateShowProgress,
        updateExcludedFolders,
        colors
    } = useTheme();

    const { getAllFolders, getSortMethods } = useMedia();
    const [showPickerSort, setShowPickerSort] = useState(false);
    const [showPickerExclude, setShowPickerExclude] = useState(false);

    // Get actual folders from media context
    const folders = getAllFolders();
    const sortMethods = getSortMethods();

    const sortOptions = sortMethods.map(method => ({
        label: method.name,
        value: method.key,
        icon: <Ionicons name={method.icon} size={16} />,
        description: `Sort by ${method.name.toLowerCase()}`
    }));

    const getSortLabel = () => {
        return sortOptions.find(opt => opt.value === sortMethod)?.label || 'Item Count';
    };

    const getExcludedLabel = () => {
        if (excludedFolders.length === 0) return 'None excluded';
        if (excludedFolders.length === 1) return '1 folder excluded';
        return `${excludedFolders.length} folders excluded`;
    };

    return (
        <AnimatedCard animatedStyle={animatedStyle}>
            <SettingRow
                icon="swap-vertical-outline"
                title="Sort Method"
                desc={`Currently: ${getSortLabel()}`}
                onPress={() => setShowPickerSort(true)}
            >
                <PickerSheet
                    visible={showPickerSort}
                    onClose={() => setShowPickerSort(false)}
                    value={sortMethod}
                    options={sortOptions}
                    onChange={updateSortMethod}
                    title="Sort Method"
                />

            </SettingRow>

            <SettingRow
                icon="eye-off-outline"
                title="Exclude Folders"
                desc={getExcludedLabel()}
                onPress={() => setShowPickerExclude(true)}
            >
                <PickerSheet
                    visible={showPickerExclude}
                    onClose={() => setShowPickerExclude(false)}
                    value={excludedFolders}
                    options={folders.map(f => ({ label: f.name, value: f.id }))}
                    onChange={updateExcludedFolders}
                    title="Exclude Folders"
                    multiple={true}
                />
            </SettingRow>

            <SettingRow
                icon="refresh-outline"
                title="Auto Refresh"
                desc="Automatically refresh folder data when app opens"
                onPress={() => updateAutoRefresh(!autoRefresh)}
            >
                <Switch
                    value={autoRefresh}
                    onValueChange={updateAutoRefresh}
                />
            </SettingRow>

            <SettingRow
                icon="bar-chart-outline"
                title="Show Progress Indicators"
                desc="Display cleanup progress in folder cards"
                noBorder
                onPress={() => updateShowProgress(!showProgress)}
            >
                <Switch
                    value={showProgress}
                    onValueChange={updateShowProgress}
                />
            </SettingRow>

            
        
        </AnimatedCard>
    );
});

const CleanupCard = memo(({ animatedStyle }) => {
    const {
        confirmBeforeDelete,
        saveDeletedHistory,
        autoBackup,
        batchSize,
        updateConfirmBeforeDelete,
        updateSaveDeletedHistory,
        updateAutoBackup,
        updateBatchSize,
        batchSizeMap,
        colors
    } = useTheme();

    const [showPickerBatch, setShowPickerBatch] = useState(false);

    const batchOptions = [
        { label: 'Small (5 items)', value: 'small', icon: <Ionicons name="grid-outline" size={16} />, description: 'Process 5 items at a time' },
        { label: 'Medium (10 items)', value: 'medium', icon: <Ionicons name="grid-outline" size={16} />, description: 'Process 10 items at a time' },
        { label: 'Large (20 items)', value: 'large', icon: <Ionicons name="grid-outline" size={16} />, description: 'Process 20 items at a time' },
        { label: 'Extra Large (50 items)', value: 'xlarge', icon: <Ionicons name="grid-outline" size={16} />, description: 'Process 50 items at a time' },
    ];

    const getBatchLabel = () => {
        return batchOptions.find(opt => opt.value === batchSize)?.label || 'Medium (10 items)';
    };

    return (
        <AnimatedCard animatedStyle={animatedStyle}>
            <SettingRow
                icon="shield-checkmark-outline"
                title="Confirm Before Delete"
                desc="Ask for confirmation before deleting items"
                onPress={() => updateConfirmBeforeDelete(!confirmBeforeDelete)}
            >
                <Switch
                    value={confirmBeforeDelete}
                    onValueChange={updateConfirmBeforeDelete}
                />
            </SettingRow>

            <SettingRow
                icon="time-outline"
                title="Save Deletion History"
                desc="Keep track of deleted items and space saved"
                onPress={() => updateSaveDeletedHistory(!saveDeletedHistory)}
            >
                <Switch
                    value={saveDeletedHistory}
                    onValueChange={updateSaveDeletedHistory}
                />
            </SettingRow>

            <SettingRow
                icon="layers-outline"
                title="Batch Size"
                desc={`Load ${getBatchLabel().toLowerCase()}`}
                onPress={() => setShowPickerBatch(true)}
            >
                <PickerSheet
                    visible={showPickerBatch}
                    onClose={() => setShowPickerBatch(false)}
                    value={batchSize}
                    options={batchOptions}
                    onChange={updateBatchSize}
                    title="Batch Size"
                />
            </SettingRow>

            <SettingRow
                icon="save-outline"
                title="Auto Backup Progress"
                desc="Automatically save cleanup progress"
                noBorder
                onPress={() => updateAutoBackup(!autoBackup)}
            >
                <Switch
                    value={autoBackup}
                    onValueChange={updateAutoBackup}
                />
            </SettingRow>

            
        </AnimatedCard>
    );
});

const AboutCard = memo(({ animatedStyle }) => {
    const { colors } = useTheme();

    const handleReportBug = useCallback(() => {
        Linking.openURL(
            'mailto:farhanzafarr.9@gmail.com?subject=Bug Report - Aurix &body=Please describe the bug you encountered:'
        );
    }, []);

    const handleSendSuggestion = useCallback(() => {
        Linking.openURL(
            'mailto:farhanzafarr.9@gmail.com?subject=Feature Suggestion - Aurix &body=Please describe your suggestion:'
        );
    }, []);

    const handleOpenRepo = useCallback(() => {
        Linking.openURL('https://github.com/FarhanZafarr-9/Aurix');
    }, []);

    return (
        <AnimatedCard animatedStyle={animatedStyle}>
            <SettingRow
                icon="information-circle-outline"
                title="Version"
                desc={`Media Cleanup v${APP_VERSION}`}
            >
                <Text style={{ color: colors.textTertiary, fontSize: 14 }}>{APP_VERSION}</Text>
            </SettingRow>

            <SettingRow
                icon="bug-outline"
                title="Report Bug"
                desc="Found an issue? Let us know"
                onPress={handleReportBug}
            />

            <SettingRow
                icon="bulb-outline"
                title="Send Suggestion"
                desc="Have an idea? We'd love to hear it"
                onPress={handleSendSuggestion}
            />

            <SettingRow
                icon="logo-github"
                title="View Repository"
                desc="Check out the source code"
                noBorder
                onPress={handleOpenRepo}
            />
        </AnimatedCard>
    );
});

/* ------------------------------------------------------------------ */
/*  Main Settings Screen                                              */
/* ------------------------------------------------------------------ */

export default function Settings() {
    const { colors } = useTheme();

    // Animation refs
    const card1Translate = useRef(new Animated.Value(-50)).current;
    const card2Translate = useRef(new Animated.Value(-50)).current;
    const card3Translate = useRef(new Animated.Value(-50)).current;
    const card4Translate = useRef(new Animated.Value(-50)).current;

    const card1Opacity = useRef(new Animated.Value(0)).current;
    const card2Opacity = useRef(new Animated.Value(0)).current;
    const card3Opacity = useRef(new Animated.Value(0)).current;
    const card4Opacity = useRef(new Animated.Value(0)).current;

    const [mounted, setMounted] = useState(false);

    // Stagger animation
    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true);
            Animated.stagger(100, [
                Animated.parallel([
                    Animated.spring(card1Translate, {
                        toValue: 0,
                        tension: 80,
                        friction: 8,
                        useNativeDriver: true
                    }),
                    Animated.timing(card1Opacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true
                    }),
                ]),
                Animated.parallel([
                    Animated.spring(card2Translate, {
                        toValue: 0,
                        tension: 80,
                        friction: 8,
                        useNativeDriver: true
                    }),
                    Animated.timing(card2Opacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true
                    }),
                ]),
                Animated.parallel([
                    Animated.spring(card3Translate, {
                        toValue: 0,
                        tension: 80,
                        friction: 8,
                        useNativeDriver: true
                    }),
                    Animated.timing(card3Opacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true
                    }),
                ]),
                Animated.parallel([
                    Animated.spring(card4Translate, {
                        toValue: 0,
                        tension: 80,
                        friction: 8,
                        useNativeDriver: true
                    }),
                    Animated.timing(card4Opacity, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true
                    }),
                ]),
            ]).start();
        }, 50);

        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header matching other screens Customize your cleanup experience,   */}
            <View style={[styles.header, { backgroundColor: colors.header, borderBottomColor: colors.borderLight }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                        Settings are still under implementation or testing phases
                    </Text>
                </View>
                <Ionicons name="settings-outline" size={20} color={colors.textTertiary} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {mounted && (
                    <>
                        <SectionHeader>Appearance</SectionHeader>
                        <AppearanceCard
                            animatedStyle={{
                                transform: [{ translateX: card1Translate }],
                                opacity: card1Opacity,
                            }}
                        />

                        <SectionHeader>Organization</SectionHeader>
                        <OrganizationCard
                            animatedStyle={{
                                transform: [{ translateX: card2Translate }],
                                opacity: card2Opacity,
                            }}
                        />

                        <SectionHeader>Cleanup Behavior</SectionHeader>
                        <CleanupCard
                            animatedStyle={{
                                transform: [{ translateX: card3Translate }],
                                opacity: card3Opacity,
                            }}
                        />

                        <SectionHeader>About</SectionHeader>
                        <AboutCard
                            animatedStyle={{
                                transform: [{ translateX: card4Translate }],
                                opacity: card4Opacity,
                            }}
                        />
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingBottom: 55
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 36,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 0.5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
    },
    headerSubtitle: {
        fontSize: 12,
        marginTop: 4,
        height: 18
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 15,
        paddingTop: 8,
        paddingBottom: 30,
    },
});