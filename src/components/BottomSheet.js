import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function BottomSheet({
    visible,
    title,
    pillText,
    message,
    buttons = [],
    actions = [],
    onClose,
    destructiveIndex = -1,
    successiveIndex = -1
}) {
    const { colors } = useTheme();

    const styles = useMemo(() => StyleSheet.create({
        modalContainer: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.5)',
        },
        container: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 24,
        },
        headerRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        title: {
            color: colors.text,
            fontSize: 18,
            fontWeight: '600',
            flex: 1,
            height: 30
        },
        closeButton: {
            padding: 6,
            marginLeft: 12,
        },
        pill: {
            alignSelf: 'flex-start',
            backgroundColor: colors.card,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 50,
            marginBottom: 12,
        },
        pillText: {
            color: colors.textSecondary,
            fontSize: 12,
            fontWeight: '500',
        },
        message: {
            color: colors.textSecondary,
            fontSize: 14,
            marginBottom: 24,
            textAlign: 'center',
        },
        buttonsContainer: {
            marginTop: 8,
        },
        row: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        halfButton: {
            width: '48%',
        },
        fullButton: {
            width: '100%',
        },
        button: {
            paddingVertical: 12,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.card,
        },
        buttonText: {
            fontSize: 16,
            fontWeight: '500',
            color: colors.text,
        },
        destructiveButton: {
            backgroundColor: 'rgba(255, 59, 48, 0.1)',
        },
        destructiveText: {
            color: '#FF3B30',
        },
        successiveButton: {
            backgroundColor: 'rgba(52, 199, 89, 0.1)',
        },
        successiveText: {
            color: '#34C759',
        },
    }), [colors]);

    const renderButtons = useCallback(() => {
        const validButtons = buttons.filter(btn => btn !== null);
        const validActions = actions.filter((_, i) => buttons[i] !== null);

        const buttonEls = validButtons.map((label, i) => {
            const isDestructive = i === destructiveIndex;
            const isSuccessive = i === successiveIndex;

            return (
                <TouchableOpacity
                    key={i}
                    style={[
                        styles.button,
                        i < validButtons.length - 1 ? styles.halfButton : styles.fullButton,
                        isDestructive && styles.destructiveButton,
                        isSuccessive && styles.successiveButton,
                    ]}
                    onPress={validActions[i]}
                >
                    <Text style={[
                        styles.buttonText,
                        isDestructive && styles.destructiveText,
                        isSuccessive && styles.successiveText,
                    ]}>
                        {label}
                    </Text>
                </TouchableOpacity>
            );
        });

        return (
            <View style={styles.buttonsContainer}>
                <View style={styles.row}>
                    {buttonEls.slice(0, 2)}
                </View>
                {buttonEls[2] && <View>{buttonEls[2]}</View>}
            </View>
        );
    }, [buttons, actions, destructiveIndex, successiveIndex, styles]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={onClose}
                />
                <View style={styles.container}>
                    <View style={styles.headerRow}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Ionicons name="close" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {pillText && (
                        <View style={styles.pill}>
                            <Text style={styles.pillText}>{pillText}</Text>
                        </View>
                    )}

                    {message && <Text style={styles.message}>{message}</Text>}

                    {renderButtons()}
                </View>
            </View>
        </Modal>
    );
}
