import { forwardRef } from 'react';
import { motion } from 'motion/react';

interface CardProps {
  variant?: 'default' | 'elevated' | 'outline';
  hoverable?: boolean;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

const variants = {
  default: 'bg-stone-800/80 border-stone-700',
  elevated: 'bg-stone-800 border-stone-600 shadow-xl shadow-black/30',
  outline: 'bg-transparent border-stone-600',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', hoverable = false, className = '', children, onClick }, ref) => {
    if (hoverable) {
      return (
        <motion.div
          ref={ref}
          onClick={onClick}
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className={`
            rounded-xl border-2 backdrop-blur-sm cursor-pointer
            ${variants[variant]}
            ${className}
          `}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={`
          rounded-xl border-2 backdrop-blur-sm
          ${variants[variant]}
          ${className}
        `}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
export default Card;
