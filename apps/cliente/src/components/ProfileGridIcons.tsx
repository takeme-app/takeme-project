import React from 'react';
import Svg, { Path } from 'react-native-svg';

const size = 24;
const fill = '#0D0D0D';

/** Ícone de Perfil (grid da aba Perfil — não é o ícone da navbar). */
export function IconProfileGrid({ color = fill, width = size, height = size }: { color?: string; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 6C13.1 6 14 6.9 14 8C14 9.1 13.1 10 12 10C10.9 10 10 9.1 10 8C10 6.9 10.9 6 12 6ZM12 16C14.7 16 17.8 17.29 18 18H6C6.23 17.28 9.31 16 12 16ZM12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z"
        fill={color}
      />
    </Svg>
  );
}

/** Ícone de Notificações (sino). */
export function IconNotifications({ color = fill, width = size, height = size }: { color?: string; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.37 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.64 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16ZM16 17H8V11C8 8.52 9.51 6.5 12 6.5C14.49 6.5 16 8.52 16 11V17Z"
        fill={color}
      />
    </Svg>
  );
}

/** Ícone de Dependentes (pessoas). */
export function IconDependents({ color = fill, width = size, height = size }: { color?: string; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6ZM17 2H19V2.4C18.9 4.6 18.2 6.3 16.7 7.5C16.2 7.9 15.6 8.2 15 8.4V22H13V16H11V22H9V10.1C8.7 10.2 8.5 10.3 8.4 10.4C7.5 11.1 7.01 12 7 13.5V14H5V13.5C5 11.5 5.71 9.91 7.11 8.71C8.21 7.81 10 7 12 7C14 7 14.68 6.54 15.48 5.94C16.48 5.14 17 4 17 2.5V2ZM4 16H7V22H4V16Z"
        fill={color}
      />
    </Svg>
  );
}

/** Ícone de Conversas (balão de chat com linhas). */
export function IconConversations({ color = fill, width = size, height = size }: { color?: string; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4H20V16H5.17L4 17.17V4ZM4 2C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2H4ZM6 12H14V14H6V12ZM6 9H18V11H6V9ZM6 6H18V8H6V6Z"
        fill={color}
      />
    </Svg>
  );
}
