import React, { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Animated,
    Switch as RNSwitch,
    Linking,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// TODO: Add these imports when implementing
// import { useMedia } from '../contexts/MediaContext';
// import PickerSheet from '../components/PickerSheet';
// import HeaderScreen from '../components/HeaderScreen';

const APP_VERSION = '1.0.0';

/* ------------------------------------------------------------------ */
/*  Helper Components                                                 */
/* ------------------------------------------------------------------ */

// TODO: Implement PickerSheet component
const PickerSheet = ({ value, options, onChange, title, visible, onClose }) => {
    // Placeholder - implement proper picker sheet
    return null;
};

// TODO: Implement proper Switch component
const Switch = ({ value, onValueChange, trackColor, thumbColor }) => {
    return (
        <RNSwitch
            value={value}
            onValueChange={onValueChange}
            trackColor={trackColor}
            thumbColor={thumbColor}
            ios_backgroundColor={trackColor?.false}
        />
    );
};

const SectionHeader = memo(({ children }) => {
    const styles = useMemo(() => StyleSheet.create({
        sectionHeader: {
            paddingVertical: 12,
            paddingHorizontal: 20,
            backgroundColor: '#181818'
        },
        sectionHeaderText: {
            fontSize: 13,
            fontWeight: 'bold',
            color: '#666',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
    }), []);

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
    const styles = useMemo(() => StyleSheet.create({
        card: {
            backgroundColor: 'transparent',
            marginBottom: 15,
            borderRadius: 12,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: '#2a2a2a',
        },
    }), []);

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
    const styles = useMemo(() => StyleSheet.create({
        settingBlock: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 18,
            paddingBottom: 14,
            paddingHorizontal: 20,
            backgroundColor: '#1a1a1a',
            borderBottomWidth: noBorder ? 0 : 1,
            borderBottomColor: '#2a2a2a',
        },
        settingTextBlock: { flex: 1 },
        settingTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: '#fff',
            marginBottom: 2,
            height: 22,
        },
        settingDesc: {
            fontSize: 13,
            color: '#888',
            opacity: 0.85,
            height: 18,
        },
    }), [noBorder]);

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
                    color="#666"
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
    const [darkMode, setDarkMode] = useState(true);
    const [showMediaCounts, setShowMediaCounts] = useState(true);
    const [hideCompleted, setHideCompleted] = useState(false);
    const [compactView, setCompactView] = useState(false);

    const trackColorActive = { false: '#444', true: '#4CAF50' };
    const trackColorInactive = { false: '#444', true: '#666' };

    return (
        <AnimatedCard animatedStyle={animatedStyle}>
            <SettingRow
                icon="moon-outline"
                title="Dark Mode"
                desc="Use dark theme"
                onPress={() => setDarkMode(!darkMode)}
            >
                <Switch
                    value={darkMode}
                    onValueChange={setDarkMode}
                    trackColor={trackColorActive}
                    thumbColor={darkMode ? '#fff' : '#ccc'}
                />
            </SettingRow>

            <SettingRow
                icon="analytics-outline"
                title="Show Media Counts"
                desc="Display photo and video counts in folder cards"
                onPress={() => setShowMediaCounts(!showMediaCounts)}
            >
                <Switch
                    value={showMediaCounts}
                    onValueChange={setShowMediaCounts}
                    trackColor={trackColorActive}
                    thumbColor={showMediaCounts ? '#fff' : '#ccc'}
                />
            </SettingRow>

            <SettingRow
                icon="eye-off-outline"
                title="Hide Completed"
                desc="Hide folders that have been completed"
                onPress={() => setHideCompleted(!hideCompleted)}
            >
                <Switch
                    value={hideCompleted}
                    onValueChange={setHideCompleted}
                    trackColor={trackColorActive}
                    thumbColor={hideCompleted ? '#fff' : '#ccc'}
                />
            </SettingRow>

            <SettingRow
                icon="contract-outline"
                title="Compact View"
                desc="Use smaller cards for more folders on screen"
                noBorder
                onPress={() => setCompactView(!compactView)}
            >
                <Switch
                    value={compactView}
                    onValueChange={setCompactView}
                    trackColor={trackColorActive}
                    thumbColor={compactView ? '#fff' : '#ccc'}
                />
            </SettingRow>
        </AnimatedCard>
    );
});

const OrganizationCard = memo(({ animatedStyle }) => {
    const [sortMethod, setSortMethod] = useState('count');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [showProgress, setShowProgress] = useState(true);
    const [showPickerSort, setShowPickerSort] = useState(false);
    const [showPickerExclude, setShowPickerExclude] = useState(false);
    const [excludedFolders, setExcludedFolders] = useState([]);

    // Mock folder data - replace with actual folder data from context
    const mockFolders = [
        { id: '1', name: 'Camera' },
        { id: '2', name: 'Screenshots' },
        { id: '3', name: 'Downloads' },
        { id: '4', name: 'WhatsApp Images' },
        { id: '5', name: 'Instagram' },
    ];

    const sortOptions = [
        { label: 'Item Count', value: 'count' },
        { label: 'Name (A-Z)', value: 'name' },
        { label: 'Name (Z-A)', value: 'nameDesc' },
        { label: 'Date Created', value: 'dateCreated' },
        { label: 'Last Updated', value: 'dateModified' },
        { label: 'Photo Count', value: 'photoCount' },
        { label: 'Video Count', value: 'videoCount' },
    ];

    const getSortLabel = () => {
        return sortOptions.find(opt => opt.value === sortMethod)?.label || 'Item Count';
    };

    const getExcludedLabel = () => {
        if (excludedFolders.length === 0) return 'None excluded';
        if (excludedFolders.length === 1) return '1 folder excluded';
        return `${excludedFolders.length} folders excluded`;
    };

    const trackColorActive = { false: '#444', true: '#4CAF50' };

    return (
        <AnimatedCard animatedStyle={animatedStyle}>
            <SettingRow
                icon="swap-vertical-outline"
                title="Sort Method"
                desc={`Currently: ${getSortLabel()}`}
                onPress={() => setShowPickerSort(true)}
            >
                <Ionicons name="chevron-forward" size={16} color="#666" />
            </SettingRow>

            <SettingRow
                icon="eye-off-outline"
                title="Exclude Folders"
                desc={getExcludedLabel()}
                onPress={() => setShowPickerExclude(true)}
            >
                <Ionicons name="chevron-forward" size={16} color="#666" />
            </SettingRow>

            <SettingRow
                icon="refresh-outline"
                title="Auto Refresh"
                desc="Automatically refresh folder data when app opens"
                onPress={() => setAutoRefresh(!autoRefresh)}
            >
                <Switch
                    value={autoRefresh}
                    onValueChange={setAutoRefresh}
                    trackColor={trackColorActive}
                    thumbColor={autoRefresh ? '#fff' : '#ccc'}
                />
            </SettingRow>

            <SettingRow
                icon="bar-chart-outline"
                title="Show Progress Indicators"
                desc="Display cleanup progress in folder cards"
                noBorder
                onPress={() => setShowProgress(!showProgress)}
            >
                <Switch
                    value={showProgress}
                    onValueChange={setShowProgress}
                    trackColor={trackColorActive}
                    thumbColor={showProgress ? '#fff' : '#ccc'}
                />
            </SettingRow>

            {/* TODO: Implement these pickers properly */}
            <PickerSheet
                visible={showPickerSort}
                onClose={() => setShowPickerSort(false)}
                value={sortMethod}
                options={sortOptions}
                onChange={setSortMethod}
                title="Sort Method"
            />

            <PickerSheet
                visible={showPickerExclude}
                onClose={() => setShowPickerExclude(false)}
                value={excludedFolders}
                options={mockFolders.map(f => ({ label: f.name, value: f.id }))}
                onChange={setExcludedFolders}
                title="Exclude Folders"
                multiple={true}
            />
        </AnimatedCard>
    );
});

const CleanupCard = memo(({ animatedStyle }) => {
    const [confirmBeforeDelete, setConfirmBeforeDelete] = useState(true);
    const [saveDeletedHistory, setSaveDeletedHistory] = useState(true);
    const [autoBackup, setAutoBackup] = useState(false);
    const [batchSize, setBatchSize] = useState('medium');
    const [showPickerBatch, setShowPickerBatch] = useState(false);

    const batchOptions = [
        { label: 'Small (5 items)', value: 'small' },
        { label: 'Medium (10 items)', value: 'medium' },
        { label: 'Large (20 items)', value: 'large' },
        { label: 'Extra Large (50 items)', value: 'xlarge' },
    ];

    const getBatchLabel = () => {
        return batchOptions.find(opt => opt.value === batchSize)?.label || 'Medium (10 items)';
    };

    const trackColorActive = { false: '#444', true: '#4CAF50' };

    return (
        <AnimatedCard animatedStyle={animatedStyle}>
            <SettingRow
                icon="shield-checkmark-outline"
                title="Confirm Before Delete"
                desc="Ask for confirmation before deleting items"
                onPress={() => setConfirmBeforeDelete(!confirmBeforeDelete)}
            >
                <Switch
                    value={confirmBeforeDelete}
                    onValueChange={setConfirmBeforeDelete}
                    trackColor={trackColorActive}
                    thumbColor={confirmBeforeDelete ? '#fff' : '#ccc'}
                />
            </SettingRow>

            <SettingRow
                icon="time-outline"
                title="Save Deletion History"
                desc="Keep track of deleted items and space saved"
                onPress={() => setSaveDeletedHistory(!saveDeletedHistory)}
            >
                <Switch
                    value={saveDeletedHistory}
                    onValueChange={setSaveDeletedHistory}
                    trackColor={trackColorActive}
                    thumbColor={saveDeletedHistory ? '#fff' : '#ccc'}
                />
            </SettingRow>

            <SettingRow
                icon="layers-outline"
                title="Batch Size"
                desc={`Load ${getBatchLabel().toLowerCase()}`}
                onPress={() => setShowPickerBatch(true)}
            >
                <Ionicons name="chevron-forward" size={16} color="#666" />
            </SettingRow>

            <SettingRow
                icon="save-outline"
                title="Auto Backup Progress"
                desc="Automatically save cleanup progress"
                noBorder
                onPress={() => setAutoBackup(!autoBackup)}
            >
                <Switch
                    value={autoBackup}
                    onValueChange={setAutoBackup}
                    trackColor={trackColorActive}
                    thumbColor={autoBackup ? '#fff' : '#ccc'}
                />
            </SettingRow>

            <PickerSheet
                visible={showPickerBatch}
                onClose={() => setShowPickerBatch(false)}
                value={batchSize}
                options={batchOptions}
                onChange={setBatchSize}
                title="Batch Size"
            />
        </AnimatedCard>
    );
});

const AboutCard = memo(({ animatedStyle }) => {

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
                <Text style={{ color: '#666', fontSize: 14 }}>{APP_VERSION}</Text>
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
        <View style={styles.container}>
            {/* Header matching other screens */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Settings</Text>
                    <Text style={styles.headerSubtitle}>
                        Customize your cleanup experience
                    </Text>
                </View>
                <Ionicons name="settings-outline" size={20} color="#666" />
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
        backgroundColor: '#0a0a0a',
        paddingBottom: 55
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 36,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#181818',
        borderBottomWidth: 0.5,
        borderBottomColor: '#333'
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
    },
    headerSubtitle: {
        color: '#666',
        fontSize: 12,
        marginTop: 4
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