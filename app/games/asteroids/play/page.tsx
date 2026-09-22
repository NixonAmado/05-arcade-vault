import { Metadata } from 'next';
import AsteroidsGameComponent from '@/components/AsteroidsGame';

export const metadata: Metadata = {
  title: 'Asteroids',
  description: 'Clásico arcade de destrucción de asteroides.',
};

export default function AsteroidsPage() {
  return <AsteroidsGameComponent />;
}
