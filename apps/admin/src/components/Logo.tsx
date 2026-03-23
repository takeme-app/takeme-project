import React from 'react';
import { webStyles } from '../styles/webStyles';
import { logoArrowSvg } from './icons';

const logoAdminAsset = require('../../assets/logo-admin.png');
const logoAsset = require('../../assets/logo.png');
const logoFigmaAsset = require('../../assets/logo1.png');

function getLogoWebSrc(asset: unknown): string | null {
  if (typeof asset === 'string') return asset;
  if (asset && typeof asset === 'object') {
    const u = (asset as { uri?: string; default?: string }).uri ?? (asset as { default?: string }).default;
    if (typeof u === 'string') return u;
  }
  return null;
}

export function Logo({ variant = 'auth' }: { variant?: 'auth' | 'navbar' }) {
  const logoSrc = getLogoWebSrc(logoAdminAsset) ?? getLogoWebSrc(logoFigmaAsset) ?? getLogoWebSrc(logoAsset);
  const style = variant === 'navbar' ? { ...webStyles.logoImgWide, height: 39 } : webStyles.logoImgWide;
  if (logoSrc) {
    return React.createElement('img', { src: logoSrc, alt: 'Take Me', style });
  }
  const iconStyle = variant === 'navbar' ? { ...webStyles.logoPlaceholderIcon, width: 40, height: 39 } : webStyles.logoPlaceholderIcon;
  return React.createElement('div', { style: webStyles.logoPlaceholder },
    React.createElement('div', { style: iconStyle }, logoArrowSvg),
    React.createElement('div', { style: webStyles.logoPlaceholderText },
      React.createElement('span', { style: webStyles.logoPlaceholderTake }, 'Take '),
      React.createElement('span', { style: webStyles.logoPlaceholderMe }, 'Me')));
}
