import test from 'node:test';
import assert from 'node:assert/strict';
import {listingPhotoType,listingPhotoTokenPolicy,LISTING_PHOTO_MAX_BYTES} from './photo-upload';
test('camera file types and empty browser MIME are supported; unsupported files rejected',()=>{
 for(const [name,type,expected] of [['DSC03023.JPEG','','image/jpeg'],['room.png','image/png','image/png'],['room.webp','image/webp','image/webp'],['room.jpg','image/png',null],['raw.cr3','image/x-canon-cr3',null],['room.heic','image/heic',null],['page.svg','image/svg+xml',null]])assert.equal(listingPhotoType({name:name!,type:type!}),expected);
});
test('photo token is capped, cannot overwrite, and cannot write outside photo paths',()=>{
 const policy=listingPhotoTokenPolicy('vater/listing-photos/12345678-1234-1234-1234-123456789abc.jpg');
 assert.equal(policy.maximumSizeInBytes,100*1024*1024);assert.equal(LISTING_PHOTO_MAX_BYTES,policy.maximumSizeInBytes);assert.equal(policy.allowOverwrite,false);
 for(const path of ['shop/test.jpg','vater/listing-photos/../../test.jpg','vater/listing-photos/12345678-1234-1234-1234-123456789abc.svg'])assert.throws(()=>listingPhotoTokenPolicy(path));
});
