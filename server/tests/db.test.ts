import { describe, expect, it } from 'vitest';
import { connectDatabase, redactUri } from '../src/db/connect';

describe('database connection helpers', () => {
  it('hides credentials in connection strings before logging', () => {
    expect(redactUri('mongodb+srv://alice:s3cret@cluster0.example.net/campuscare')).toBe(
      'mongodb+srv://***:***@cluster0.example.net/campuscare',
    );
    expect(redactUri('mongodb://127.0.0.1:27017/campuscare')).toBe(
      'mongodb://127.0.0.1:27017/campuscare',
    );
  });

  it('gives a helpful error when MongoDB is unreachable', async () => {
    // Port 1 is never a MongoDB server, so this must fail quickly and clearly.
    await expect(
      connectDatabase('mongodb://user:pw@127.0.0.1:1/test?serverSelectionTimeoutMS=500'),
    ).rejects.toThrow(/Could not connect to MongoDB at mongodb:\/\/\*\*\*:\*\*\*@127\.0\.0\.1:1/);
  }, 15_000);
});
