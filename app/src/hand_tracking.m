#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#include <string.h>

// Vision ships with macOS; no downloaded runtime or model is required.
char *handverse_track(const unsigned char *bytes, size_t length) {
    @autoreleasepool {
        NSError *error = nil;
        NSData *image = [NSData dataWithBytes:bytes length:length];
        VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithData:image options:@{}];
        VNDetectHumanHandPoseRequest *request = [VNDetectHumanHandPoseRequest new];
        request.maximumHandCount = 2;
        if (![handler performRequests:@[request] error:&error]) {
            NSData *failure = [NSJSONSerialization dataWithJSONObject:@{@"error": error.localizedDescription ?: @"Hand tracking could not read the camera frame"} options:0 error:nil];
            return strdup([[NSString alloc] initWithData:failure encoding:NSUTF8StringEncoding].UTF8String);
        }
        NSArray *joints = @[
            VNHumanHandPoseObservationJointNameWrist,
            VNHumanHandPoseObservationJointNameThumbCMC, VNHumanHandPoseObservationJointNameThumbMP, VNHumanHandPoseObservationJointNameThumbIP, VNHumanHandPoseObservationJointNameThumbTip,
            VNHumanHandPoseObservationJointNameIndexMCP, VNHumanHandPoseObservationJointNameIndexPIP, VNHumanHandPoseObservationJointNameIndexDIP, VNHumanHandPoseObservationJointNameIndexTip,
            VNHumanHandPoseObservationJointNameMiddleMCP, VNHumanHandPoseObservationJointNameMiddlePIP, VNHumanHandPoseObservationJointNameMiddleDIP, VNHumanHandPoseObservationJointNameMiddleTip,
            VNHumanHandPoseObservationJointNameRingMCP, VNHumanHandPoseObservationJointNameRingPIP, VNHumanHandPoseObservationJointNameRingDIP, VNHumanHandPoseObservationJointNameRingTip,
            VNHumanHandPoseObservationJointNameLittleMCP, VNHumanHandPoseObservationJointNameLittlePIP, VNHumanHandPoseObservationJointNameLittleDIP, VNHumanHandPoseObservationJointNameLittleTip
        ];
        NSMutableArray *landmarks = [NSMutableArray array], *handedness = [NSMutableArray array];
        for (VNHumanHandPoseObservation *hand in request.results) {
            NSMutableArray *points = [NSMutableArray array];
            float confidence = 0;
            for (VNHumanHandPoseObservationJointName joint in joints) {
                VNRecognizedPoint *point = [hand recognizedPointForJointName:joint error:&error];
                if (!point) break;
                // Vision's origin is bottom-left; the game uses top-left camera coordinates.
                [points addObject:@{@"x": @(point.location.x), @"y": @(1 - point.location.y)}];
                confidence += point.confidence;
            }
            if (points.count != 21 || confidence / 21 < 0.6) continue;
            [landmarks addObject:points];
            NSString *side = hand.chirality == VNChiralityLeft ? @"Left" : @"Right";
            [handedness addObject:@[@{@"categoryName": side, @"score": @(confidence / 21)}]];
        }
        NSData *json = [NSJSONSerialization dataWithJSONObject:@{@"landmarks": landmarks, @"handedness": handedness} options:0 error:&error];
        return strdup([[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding].UTF8String);
    }
}
void handverse_free(char *result) { free(result); }
