/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
*/

import { Duration, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as loadbalancing from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { NagSuppressions } from 'cdk-nag';
const fs = require('fs');

export class WebAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'MyVPC')

    const alb = this.createAlb(vpc);
    const nlb = this.createNlb(vpc);

    new CfnOutput(this, 'AlbHostname', { value: alb.loadBalancerDnsName })
    new CfnOutput(this, 'NlbHostname', { value: nlb.loadBalancerDnsName })

    // suppressions for cdk-nag, a module that looks for security compliance with security patterns in CDK projects.

    NagSuppressions.addResourceSuppressions(vpc, [
      { id: 'AwsSolutions-VPC7', reason: 'For brevity, this non-production example stack shall not configure a VPC flow log.' },
    ])
  }

  createAlb(vpc: ec2.Vpc){
    const asg = new autoscaling.AutoScalingGroup(this, 'MyAlbASG', {
      vpc: vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }),
      minCapacity: 2
    })

    asg.addUserData(fs.readFileSync('scripts/install.sh', 'utf8'))


    const alb = new loadbalancing.ApplicationLoadBalancer(this, 'MyALB', {
      vpc: vpc,
      internetFacing: true,
    })

    const listener = alb.addListener('HttpListener', {
      port: 80
    })

    listener.addTargets('Targets', {
      port: 80,
      targets: [asg]
    })

    listener.connections.allowDefaultPortFromAnyIpv4('Allow access to port 80 from the internet.')
    NagSuppressions.addResourceSuppressions(asg, [
      { id: 'AwsSolutions-AS3', reason: 'For brevity, this non-production example stack shall not configure scaling notifications.' },
    ])


    NagSuppressions.addResourceSuppressions(alb, [
      { id: 'AwsSolutions-ELB2', reason: 'For brevity, this non-production example stack shall not enable load balancer access logs.' },
    ])

    NagSuppressions.addResourceSuppressions(alb, [
      { id: 'AwsSolutions-EC23', reason: 'The security group is expected to allow unrestricted inbound access, as it represents a public web application.' },
    ], true)


    return alb;
  }


  createNlb(vpc: ec2.Vpc){
    const asg = new autoscaling.AutoScalingGroup(this, 'MyNlbASG', {
      vpc: vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux({ generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2 }),
      vpcSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }),
      minCapacity: 2
    })
    asg.addUserData(fs.readFileSync('scripts/install.sh', 'utf8'))
    const nlbSg = new ec2.SecurityGroup(this, 'NLBSecurityGroup', { vpc, allowAllOutbound: true });
    nlbSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP frm anywhere');

    asg.connections.allowFrom(nlbSg, ec2.Port.tcp(80));
    const nlb = new loadbalancing.NetworkLoadBalancer(this, 'MyNLB', {
      vpc: vpc,
      internetFacing: true,
      securityGroups: [nlbSg],
    })

    const listener = nlb.addListener('NlbHttpListener', {
      port: 80
    })

    listener.addTargets('Targets', {
      port: 80,
      targets: [asg]
    })
    NagSuppressions.addResourceSuppressions(asg, [
      { id: 'AwsSolutions-AS3', reason: 'For brevity, this non-production example stack shall not configure scaling notifications.' },
    ])

    NagSuppressions.addResourceSuppressions(nlb, [
      { id: 'AwsSolutions-ELB2', reason: 'For brevity, this non-production example stack shall not enable load balancer access logs.' },
    ])

    NagSuppressions.addResourceSuppressions(nlb, [
      { id: 'AwsSolutions-EC23', reason: 'The security group is expected to allow unrestricted inbound access, as it represents a public web application.' },
    ], true)

    NagSuppressions.addResourceSuppressions(nlbSg, [
      { id: 'AwsSolutions-EC23', reason: 'The security group is expected to allow unrestricted inbound access, as it represents a public web application.' },
    ], true)

    return nlb;
  }
}