/** @jest-environment jsdom */
// @ts-nocheck
// import jest from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor, userEvent, cleanup, customMatchers } from './test-utils';
import UploadWidget from '../src/components/UploadWidget';

// Extend Jest matchers
expect.extend(customMatchers);

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock canvas and image for browser APIs
global.HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  drawImage: jest.fn(),
}));

global.HTMLCanvasElement.prototype.toBlob = jest.fn(function(callback) {
  const blob = new Blob(['test'], { type: 'image/jpeg' });
  setTimeout(() => callback(blob), 0);
});

global.Image = class {
  constructor() {
    this.onload = null;
    this.width = 800;
    this.height = 600;
  }
  set src(value) {
    // Trigger onload asynchronously
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
};

global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

// Mock XMLHttpRequest for upload progress
class MockXMLHttpRequest {
  constructor() {
    this.upload = {
      onprogress: null
    };
    this.onload = null;
    this.onerror = null;
    this.status = 200;
  }
  open() {}
  setRequestHeader() {}
  send() {
    setTimeout(() => {
      if (this.upload.onprogress) {
        this.upload.onprogress({ lengthComputable: true, loaded: 100, total: 100 });
      }
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
}
global.XMLHttpRequest = MockXMLHttpRequest;

describe('Concurrent Uploads Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock successful fetch responses by default
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/uploads')) {
        // Mock signed URL response
        return Promise.resolve({
          ok: true,
          json: async () => ({
            signedUrl: 'https://storage.example.com/signed-url',
            fileKey: 'test-file-key',
            publicUrl: 'https://storage.example.com/public-url'
          })
        });
      } else if (url.includes('/api/events/')) {
        // Mock post creation response
        return Promise.resolve({
          ok: true,
          json: async () => ({
            postId: 'mock-post-id'
          })
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  afterEach(() => {
    cleanup();
    jest.resetAllMocks();
  });

  describe('Two Users Concurrent Upload', () => {
    it('should handle two users uploading different photos simultaneously without conflict', async () => {
      let postCount = 0;

      // Mock unique post IDs for each upload
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/events/')) {
          postCount++;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              postId: `post-${postCount}`
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            signedUrl: 'https://storage.example.com/signed-url',
            fileKey: 'test-file-key',
            publicUrl: 'https://storage.example.com/public-url'
          })
        });
      });

      // Render two UploadWidget instances
      const { container: container1 } = render(
        <UploadWidget eventId="event-1" token="user-1-token" onUploadComplete={jest.fn()} />
      );

      const container2Div = document.body.appendChild(document.createElement('div'));
      const { container: container2 } = render(
        <UploadWidget eventId="event-2" token="user-2-token" onUploadComplete={jest.fn()} />,
        { container: container2Div }
      );

      // Upload files
      const fileInput1 = container1.querySelector('input[type="file"]');
      const fileInput2 = container2.querySelector('input[type="file"]');

      const file1 = new File(['sunset image'], 'sunset.jpg', { type: 'image/jpeg' });
      const file2 = new File(['mountain image'], 'mountain.jpg', { type: 'image/jpeg' });

      await user.upload(fileInput1, file1);
      await user.upload(fileInput2, file2);

      // Wait a bit for React to process the file upload
      fireEvent.change(fileInput1, { target: { files: [file1] } });
      fireEvent.change(fileInput2, { target: { files: [file2] } });

      // Wait for image processing and state updates to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await waitFor(() => {
        const uploadButton = container1.querySelector('button[aria-label="Upload"]');
        expect(uploadButton).not.toBeDisabled();
      }, { timeout: 3000 });

      // Get upload buttons
      const uploadButton1 = container1.querySelector('button[aria-label="Upload"]');
      const uploadButton2 = container2.querySelector('button[aria-label="Upload"]');

      await Promise.all([
        user.click(uploadButton1),
        user.click(uploadButton2)
      ]);

      // Verify both uploads completed
      await waitFor(() => {
        expect(postCount).toBe(2);
      }, { timeout: 3000 });

      expect(postCount).toBe(2);

      // Cleanup
      document.body.removeChild(container2Div);
    });

    it('should handle concurrent uploads with different file types', async () => {
      let uploadCount = 0;

      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/events/')) {
          uploadCount++;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              postId: `post-${uploadCount}`
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            signedUrl: 'https://storage.example.com/signed-url',
            fileKey: 'test-file-key',
            publicUrl: 'https://storage.example.com/public-url'
          })
        });
      });

      const { container: container1 } = render(
        <UploadWidget eventId="event-a" token="user-a-token" onUploadComplete={jest.fn()} />
      );

      const container2Div = document.body.appendChild(document.createElement('div'));
      const { container: container2 } = render(
        <UploadWidget eventId="event-b" token="user-b-token" onUploadComplete={jest.fn()} />,
        { container: container2Div }
      );

      const fileInput1 = container1.querySelector('input[type="file"]');
      const fileInput2 = container2.querySelector('input[type="file"]');

      const jpegFile = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
      const pngFile = new File(['png'], 'graphic.png', { type: 'image/png' });

      await user.upload(fileInput1, jpegFile);
      await user.upload(fileInput2, pngFile);

      // Wait for React to process
      fireEvent.change(fileInput1, { target: { files: [jpegFile] } });
      fireEvent.change(fileInput2, { target: { files: [pngFile] } });

      // Wait for image processing
      await new Promise(resolve => setTimeout(resolve, 50));

      await waitFor(() => {
        const uploadButton1 = container1.querySelector('button[aria-label="Upload"]');
        const uploadButton2 = container2.querySelector('button[aria-label="Upload"]');
        expect(uploadButton1).not.toBeDisabled();
        expect(uploadButton2).not.toBeDisabled();
      }, { timeout: 3000 });

      const uploadButton1 = container1.querySelector('button[aria-label="Upload"]');
      const uploadButton2 = container2.querySelector('button[aria-label="Upload"]');

      await Promise.all([
        user.click(uploadButton1),
        user.click(uploadButton2)
      ]);

      await waitFor(() => {
        expect(uploadCount).toBe(2);
      }, { timeout: 3000 });

      // Cleanup
      document.body.removeChild(container2Div);
    });
  });

  describe('Multiple Concurrent Uploads', () => {
    it('should handle 5 concurrent uploads successfully', async () => {
      let postCreationCount = 0;

      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/events/')) {
          postCreationCount++;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              postId: `post-${postCreationCount}`
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            signedUrl: 'https://storage.example.com/signed-url',
            fileKey: 'test-file-key',
            publicUrl: 'https://storage.example.com/public-url'
          })
        });
      });

      const containers = [];
      const concurrentCount = 5;

      // Create 5 upload widgets
      for (let i = 0; i < concurrentCount; i++) {
        const containerDiv = document.body.appendChild(document.createElement('div'));
        containers.push(containerDiv);

        render(
          <UploadWidget eventId={`event-${i + 1}`} token={`user-${i + 1}-token`} onUploadComplete={jest.fn()} />,
          { container: containerDiv }
        );
      }

      // Upload files to all widgets
      // Upload files to all widgets
      for (let i = 0; i < concurrentCount; i++) {
        const fileInput = containers[i].querySelector('input[type="file"]');
        const file = new File([`image${i + 1}`], `image-${i + 1}.jpg`, { type: 'image/jpeg' });
        fireEvent.change(fileInput, { target: { files: [file] } });
      }

      // Wait for all image processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      await waitFor(() => {
        const allEnabled = containers.every((container) => {
          const button = container.querySelector('button[aria-label="Upload"]');
          return button && !button.disabled;
        });
        expect(allEnabled).toBe(true);
      }, { timeout: 5000 });

      // Click all upload buttons
      const clickPromises = containers.map((container) => {
        const button = container.querySelector('button[aria-label="Upload"]');
        return user.click(button);
      });

      await Promise.all(clickPromises);

      // Wait for all uploads to complete
      await waitFor(() => {
        expect(postCreationCount).toBe(concurrentCount);
      }, { timeout: 5000 });

      expect(postCreationCount).toBe(concurrentCount);

      // Cleanup
      containers.forEach((container) => document.body.removeChild(container));
    }, 15000);

    it('should handle partial failures in concurrent uploads', async () => {
      let callCount = 0;

      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/events/')) {
          callCount++;
          // First 3 succeed, last 2 fail
          if (callCount <= 3) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                postId: `success-${callCount}`
              })
            });
          } else {
            return Promise.resolve({
              ok: false,
              json: async () => ({
                error: 'Failed to create post'
              })
            });
          }
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            signedUrl: 'https://storage.example.com/signed-url',
            fileKey: 'test-file-key',
            publicUrl: 'https://storage.example.com/public-url'
          })
        });
      });

      const containers = [];
      const count = 5;

      for (let i = 0; i < count; i++) {
        const containerDiv = document.body.appendChild(document.createElement('div'));
        containers.push(containerDiv);

        render(
          <UploadWidget eventId={`event-${i + 1}`} token={`user-${i + 1}-token`} onUploadComplete={jest.fn()} />,
          { container: containerDiv }
        );
      }

      // Upload files
      for (let i = 0; i < count; i++) {
        const fileInput = containers[i].querySelector('input[type="file"]');
        const file = new File([`data${i + 1}`], `file-${i + 1}.jpg`, { type: 'image/jpeg' });
        fireEvent.change(fileInput, { target: { files: [file] } });
      }

      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 100));

      await waitFor(() => {
        const allEnabled = containers.every((container) => {
          const button = container.querySelector('button[aria-label="Upload"]');
          return button && !button.disabled;
        });
        expect(allEnabled).toBe(true);
      }, { timeout: 5000 });

      // Click all buttons
      const clickPromises = containers.map((container) => {
        const button = container.querySelector('button[aria-label="Upload"]');
        return user.click(button);
      });

      await Promise.allSettled(clickPromises);

      // Wait for all attempts
      await waitFor(() => {
        expect(callCount).toBe(count);
      }, { timeout: 5000 });

      expect(callCount).toBe(count);

      // Cleanup
      containers.forEach((container) => document.body.removeChild(container));
    }, 15000);
  });

  describe('Error Handling in Concurrent Scenarios', () => {
    it('should handle database conflicts gracefully', async () => {
      let callCount = 0;

      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/events/')) {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                postId: 'success-1'
              })
            });
          } else {
            return Promise.resolve({
              ok: false,
              json: async () => ({
                error: 'Duplicate key violation'
              })
            });
          }
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            signedUrl: 'https://storage.example.com/signed-url',
            fileKey: 'test-file-key',
            publicUrl: 'https://storage.example.com/public-url'
          })
        });
      });

      const containers = [];

      const container1Div = document.body.appendChild(document.createElement('div'));
      containers.push(container1Div);
      render(
        <UploadWidget eventId="event-success" token="user-success-token" onUploadComplete={jest.fn()} />,
        { container: container1Div }
      );

      const container2Div = document.body.appendChild(document.createElement('div'));
      containers.push(container2Div);
      render(
        <UploadWidget eventId="event-conflict" token="user-conflict-token" onUploadComplete={jest.fn()} />,
        { container: container2Div }
      );

      // Upload files
      const fileInput1 = container1Div.querySelector('input[type="file"]');
      const fileInput2 = container2Div.querySelector('input[type="file"]');

      const successFile = new File(['success'], 'success.jpg', { type: 'image/jpeg' });
      const conflictFile = new File(['conflict'], 'conflict.jpg', { type: 'image/jpeg' });

      await user.upload(fileInput1, successFile);
      await user.upload(fileInput2, conflictFile);

      fireEvent.change(fileInput1, { target: { files: [successFile] } });
      fireEvent.change(fileInput2, { target: { files: [conflictFile] } });

      await new Promise(resolve => setTimeout(resolve, 50));

      await waitFor(() => {
        const button1 = container1Div.querySelector('button[aria-label="Upload"]');
        const button2 = container2Div.querySelector('button[aria-label="Upload"]');
        expect(button1).not.toBeDisabled();
        expect(button2).not.toBeDisabled();
      }, { timeout: 3000 });

      const uploadButton1 = container1Div.querySelector('button[aria-label="Upload"]');
      const uploadButton2 = container2Div.querySelector('button[aria-label="Upload"]');

      await Promise.allSettled([
        user.click(uploadButton1),
        user.click(uploadButton2)
      ]);

      await waitFor(() => {
        expect(callCount).toBe(2);
      }, { timeout: 3000 });

      expect(callCount).toBe(2);

      // Cleanup
      containers.forEach((container) => document.body.removeChild(container));
    });

    it('should display appropriate error messages for failed uploads', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/events/')) {
          return Promise.resolve({
            ok: false,
            json: async () => ({
              error: 'Network timeout'
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            signedUrl: 'https://storage.example.com/signed-url',
            fileKey: 'test-file-key',
            publicUrl: 'https://storage.example.com/public-url'
          })
        });
      });

      render(<UploadWidget eventId="test-event" token="test-token" onUploadComplete={jest.fn()} />);

      const fileInput = document.querySelector('input[type="file"]');
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await user.upload(fileInput, file);

      // Wait for React to process
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Wait for image processing
      await new Promise(resolve => setTimeout(resolve, 50));

      await waitFor(() => {
        const uploadButton = screen.getByLabelText('Upload');
        expect(uploadButton).not.toBeDisabled();
      }, { timeout: 3000 });

      const uploadButton = screen.getByLabelText('Upload');
      await user.click(uploadButton);

      // Wait for error to be displayed
      await waitFor(() => {
        const statusElement = document.querySelector('.status');
        expect(statusElement).toBeTruthy();
        expect(statusElement.textContent).toContain('Error');
      }, { timeout: 3000 });
    });
  });
});
