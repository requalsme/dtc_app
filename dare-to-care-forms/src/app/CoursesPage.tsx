import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { VideoPlayer } from '../components/ui/VideoPlayer';

interface Course {
  id: string;
  title: string;
  description: string;
  videoPath: string; // Firebase storage path e.g. "courses/intro.mp4"
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const snap = await getDocs(collection(db, "courses"));
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
        setCourses(data);
        if (data.length > 0) {
          setSelectedCourse(data[0]); // Select first by default
        }
      } catch (error) {
        console.error("Error fetching courses:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchCourses();
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Course Videos</h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Watch training videos securely streamed from Firebase Storage.
      </p>

      {loading ? (
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr 300px' }}>
          <div style={{ height: '500px', background: '#f3f4f6', borderRadius: '16px', animation: 'skeleton-loading 1.5s infinite' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ height: '80px', background: '#f3f4f6', borderRadius: '12px', animation: 'skeleton-loading 1.5s infinite' }} />
            <div style={{ height: '80px', background: '#f3f4f6', borderRadius: '12px', animation: 'skeleton-loading 1.5s infinite' }} />
          </div>
        </div>
      ) : courses.length === 0 ? (
        <div style={{ padding: '2rem', background: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
          <h3>No Courses Found</h3>
          <p>You can upload course videos to Firebase Storage and add them to the 'courses' Firestore collection.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          
          {/* Main Video Player Area */}
          <div style={{ flex: '1 1 65%', minWidth: '320px' }}>
            {selectedCourse ? (
              <VideoPlayer 
                storagePath={selectedCourse.videoPath} 
                title={selectedCourse.title} 
              />
            ) : null}
            {selectedCourse && (
              <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#111827' }}>About this module</h4>
                <p style={{ margin: 0, color: '#4b5563', lineHeight: '1.6', fontSize: '1rem' }}>
                  {selectedCourse.description}
                </p>
              </div>
            )}
          </div>

          {/* Playlist Sidebar */}
          <div style={{ flex: '1 1 30%', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#111827', fontWeight: 600 }}>Available Modules</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {courses.map(course => {
                const isActive = selectedCourse?.id === course.id;
                return (
                  <button
                    key={course.id}
                    onClick={() => setSelectedCourse(course)}
                    style={{
                      padding: '1.25rem',
                      textAlign: 'left',
                      background: isActive ? '#eff6ff' : '#ffffff',
                      border: `2px solid ${isActive ? '#3b82f6' : 'transparent'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? '0 4px 6px -1px rgba(59, 130, 246, 0.1)' : '0 1px 3px rgba(0,0,0,0.1)',
                      transform: isActive ? 'scale(1.02)' : 'scale(1)'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: isActive ? '#1d4ed8' : '#111827', marginBottom: '0.25rem', fontSize: '1rem' }}>
                      {course.title}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: isActive ? '#3b82f6' : '#6b7280', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {course.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
