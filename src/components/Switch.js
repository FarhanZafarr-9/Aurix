import React, { useEffect, useRef } from 'react';
import { View, Animated, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const Switch = ({
    value,
    onValueChange,
    track,
    thumb,
    style
}) => {
    const offsetX = useRef(new Animated.Value(value ? 32 : 2.5)).current;

    useEffect(() => {
        Animated.timing(offsetX, {
            toValue: value ? 32 : 2.5,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [value]);

    const { colors } = useTheme();

    const trackColor = track || {
        false: colors.switchTrack.false,
        true: colors.switchTrack.true
    };

    const thumbColor = thumb || {
        true: colors.switchThumb,
        false: colors.switchThumbInactive
    };

    return (
        <Pressable
            onPress={() => onValueChange(!value)}
            style={[
                styles.container,
                { backgroundColor: value ? trackColor.true : trackColor.false },
                style
            ]}
        >
            <Animated.View
                style={[
                    styles.thumb,
                    {
                        backgroundColor: value ? thumbColor.true : thumbColor.false,
                        transform: [{ translateX: offsetX }]
                    }
                ]}
            />
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 60,
        height: 28,
        borderRadius: 14,
        paddingHorizontal: 2,
        justifyContent: 'center',
        transform: [{scale: 0.9}]
    },
    thumb: {
        width: 20,
        height: 20,
        borderRadius: 12,
        elevation: 4,
    },
});

export default Switch;
