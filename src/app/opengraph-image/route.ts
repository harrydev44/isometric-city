import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const alt = 'ISOCITY — Metropolis Builder';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export async function GET(request: NextRequest) {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background grid pattern - isometric style */}
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              opacity: 0.08,
              backgroundImage: `
                linear-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.15) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
              transform: 'rotate(-45deg)',
              transformOrigin: 'center',
            }}
          />
          
          {/* Isometric diamond shapes for visual interest */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(45deg)',
              width: '400px',
              height: '400px',
              border: '2px solid rgba(255, 255, 255, 0.05)',
              opacity: 0.3,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(45deg)',
              width: '300px',
              height: '300px',
              border: '2px solid rgba(255, 255, 255, 0.05)',
              opacity: 0.2,
            }}
          />
          
          {/* Main title */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              zIndex: 1,
            }}
          >
            <h1
              style={{
                fontSize: '128px',
                fontWeight: 200,
                letterSpacing: '0.08em',
                color: 'rgba(255, 255, 255, 0.98)',
                margin: 0,
                textAlign: 'center',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              }}
            >
              ISOCITY
            </h1>
            <div
              style={{
                width: '200px',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
              }}
            />
            <p
              style={{
                fontSize: '36px',
                fontWeight: 300,
                letterSpacing: '0.04em',
                color: 'rgba(255, 255, 255, 0.75)',
                margin: 0,
                textAlign: 'center',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              Metropolis Builder
            </p>
          </div>

          {/* Decorative gradient orbs */}
          <div
            style={{
              position: 'absolute',
              top: '60px',
              left: '80px',
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '60px',
              right: '80px',
              width: '350px',
              height: '350px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
              filter: 'blur(70px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: '150px',
              transform: 'translateY(-50%)',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
              filter: 'blur(50px)',
            }}
          />

          {/* Bottom tagline */}
          <div
            style={{
              position: 'absolute',
              bottom: '50px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              zIndex: 1,
            }}
          >
            <div
              style={{
                fontSize: '20px',
                fontWeight: 300,
                letterSpacing: '0.05em',
                color: 'rgba(255, 255, 255, 0.6)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              Build • Manage • Expand
            </div>
          </div>
        </div>
      ),
      {
        ...size,
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
