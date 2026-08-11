import { useState } from 'react';
import { Heart, User } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PhotoCard({ photo, onClick, onFavorite, style }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hovered, setHovered]         = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative rounded-xl overflow-hidden cursor-pointer 
                 bg-bg-secondary group"
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(photo)}
    >
      {!imageLoaded && (
        <div className="absolute inset-0 bg-bg-tertiary animate-pulse" />
      )}

      <img
        src={photo.thumb || photo.src}
        alt=""
        onLoad={() => setImageLoaded(true)}
        className={`w-full h-full object-cover transition-all duration-500
                    ${imageLoaded ? 'opacity-100' : 'opacity-0'}
                    ${hovered ? 'scale-105' : 'scale-100'}`}
      />

      <motion.div
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-gradient-to-t from-black/70 
                   via-transparent to-black/20"
      />

      <motion.button
        animate={{ opacity: hovered || photo.favorite ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => {
          e.stopPropagation();
          onFavorite(photo.id);
        }}
        className="absolute top-2 right-2 p-1.5 rounded-full 
                   bg-black/40 backdrop-blur-sm hover:bg-black/60
                   transition-colors z-10"
      >
        <Heart
          size={14}
          className={photo.favorite
            ? 'fill-red-500 text-red-500'
            : 'text-white'}
        />
      </motion.button>

      {photo.people && photo.people.length > 0 && (
        <motion.div
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-2 left-2 right-2 flex gap-1 flex-wrap"
        >
          {photo.people.slice(0, 3).map(person => (
            <span
              key={person}
              className="text-[10px] bg-black/60 backdrop-blur-sm text-white 
                         px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
            >
              <User size={8} />
              {person}
            </span>
          ))}
          {photo.people.length > 3 && (
            <span className="text-[10px] bg-black/60 backdrop-blur-sm 
                             text-white/70 px-1.5 py-0.5 rounded-full">
              +{photo.people.length - 3}
            </span>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}