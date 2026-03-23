import React from 'react';
import { webStyles } from '../styles/webStyles';

export default function PlaceholderScreen({ title }: { title: string }) {
  return React.createElement('div', { style: { padding: 24, textAlign: 'center' as const } },
    React.createElement('h1', { style: webStyles.homeTitle }, title),
    React.createElement('p', { style: { color: '#767676', fontSize: 16, fontFamily: 'Inter, sans-serif', marginTop: 16 } }, 'Esta página está em desenvolvimento.'));
}
