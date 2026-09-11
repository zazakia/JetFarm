// Polyfill for decorators and metadata
import 'reflect-metadata';

// Polyfills
import { setupPolyfills } from './polyfills';
setupPolyfills();

// Polyfill to prevent React Native's Event constructor from crashing Hermes when setting read-only properties
(function() {
    const keys = ['NONE', 'CAPTURING_PHASE', 'AT_TARGET', 'BUBBLING_PHASE'];
    const patch = (target, name) => {
        if (!target) return;
        keys.forEach((key, index) => {
            try {
                const desc = Object.getOwnPropertyDescriptor(target, key);
                if (!desc || desc.configurable) {
                    Object.defineProperty(target, key, {
                        value: index,
                        writable: true,
                        configurable: true,
                        enumerable: true
                    });
                } else if (desc.writable) {
                    target[key] = index;
                }
            } catch (e) {
                // Ignore errors
            }
        });
    };

    const isNative = typeof global !== 'undefined' && typeof window === 'undefined';
    
    // Only apply this patch on Native (Hermes). 
    // On Web (Vercel), let the browser handle its own Event object.
    if (!isNative) return;

    const targets = [
        { obj: global, name: 'global' },
        { obj: global.Event, name: 'Event' },
        { obj: global.Event?.prototype, name: 'Event.prototype' },
        { obj: global.CustomEvent, name: 'CustomEvent' },
        { obj: global.CustomEvent?.prototype, name: 'CustomEvent.prototype' },
    ].filter(t => t.obj);

    targets.forEach(t => patch(t.obj, t.name));
})();

import 'expo-router/entry';
