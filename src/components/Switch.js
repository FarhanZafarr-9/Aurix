import React, { useEffect, useRef } from 'react';
import { View, Animated, Pressable, StyleSheet } from 'react-native';

const Switch = ({
    value,
    onValueChange,
    trackColor = { false: '#ccc', true: '#4cd964' },
    thumbColor = '#fff',
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

    return (
        <Pressable
            onPress={() => onValueChange(!value)}
            style={[
                styles.container,
                {
                    backgroundColor: value ? trackColor.true : trackColor.false,
                },
                style,
            ]}
        >
            <Animated.View
                style={[
                    styles.thumb,
                    {
                        backgroundColor: thumbColor,
                        transform: [{ translateX: offsetX }],
                    },
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
    },
    thumb: {
        width: 20,
        height: 20,
        borderRadius: 12,
        backgroundColor: '#fff',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0.5 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
    },
});

export default Switch;
